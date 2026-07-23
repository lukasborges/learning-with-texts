import assert from 'node:assert/strict';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { Builder, By, Capabilities, Key, until } from 'selenium-webdriver';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const application =
  process.env.LWT_E2E_BINARY ?? path.join(repositoryRoot, 'target', 'debug', 'lwt-desktop');
const driverUrl = 'http://127.0.0.1:4444/';
const tauriDriver =
  process.env.TAURI_DRIVER ?? path.join(os.homedir(), '.cargo', 'bin', 'tauri-driver');
const legacyBackup = path.join(repositoryRoot, 'tests', 'fixtures', 'legacy-backup-v1.json');
const evidenceDirectory = path.join(repositoryRoot, 'artifacts', 'qa');

function buttonWithText(text) {
  return By.xpath(`//button[normalize-space(.)="${text}"]`);
}

function buttonWithinText(text) {
  return By.xpath(`.//button[normalize-space(.)="${text}"]`);
}

function cardWithTitle(title) {
  return By.xpath(
    `//article[contains(@class,"text-card")][.//h2[normalize-space(.)="${title}"]]`
  );
}

async function clickCardAction(card, label) {
  const action = await card.findElement(buttonWithinText(label));
  if (!(await action.isDisplayed())) {
    await card.findElement(By.css('.text-card__menu > summary')).click();
  }
  await action.click();
}

async function visible(driver, locator, timeout = 10_000) {
  return driver.wait(async () => {
    const elements = await driver.findElements(locator);
    for (const element of elements) {
      try {
        if (await element.isDisplayed()) {
          return element;
        }
      } catch {
        // The procedural WebView may replace a screen while an async query resolves.
      }
    }
    return false;
  }, timeout);
}

async function setValue(element, value) {
  await element.clear();
  await element.sendKeys(value);
}

async function setChecked(element, checked) {
  if ((await element.isSelected()) !== checked) {
    await element.click();
  }
}

async function chooseCombobox(driver, controlLocator, optionLabel) {
  const control = await visible(driver, controlLocator);
  await control.findElement(By.css('[role="combobox"]')).click();
  const option = await driver.wait(async () => {
    const options = await control.findElements(
      By.xpath(`.//*[@role="option" and normalize-space(.)="${optionLabel}"]`)
    );
    for (const candidate of options) {
      if (await candidate.isDisplayed()) return candidate;
    }
    return false;
  }, 10_000);
  await option.click();
}

async function setDomValue(driver, selector, value) {
  await driver.executeScript(
    `const element = document.querySelector(arguments[0]);
     if (!element) throw new Error('QA control was not found: ' + arguments[0]);
     element.value = arguments[1];
     element.dispatchEvent(new Event('input', { bubbles: true }));`,
    selector,
    value
  );
}

async function clickReadingTerm(driver, text) {
  await driver.executeScript(
    `const terms = [...document.querySelectorAll('.reading-content button')];
     const term = terms.find((candidate) => candidate.textContent?.trim() === arguments[0]);
     if (!term) {
       throw new Error(
         'QA reading term was not found: ' + arguments[0] +
         '. Available: ' + terms.map((candidate) => candidate.textContent?.trim()).join(', ')
       );
     }
     term.click();`,
    text
  );
}

async function waitForText(driver, locator, expected, timeout = 10_000) {
  const element = await visible(driver, locator, timeout);
  await driver.wait(async () => (await element.getText()).includes(expected), timeout);
  return element;
}

async function capture(driver, name) {
  await writeFile(
    path.join(evidenceDirectory, name),
    Buffer.from(await driver.takeScreenshot(), 'base64')
  );
}

function checkpoint(name) {
  process.stderr.write(`# QA checkpoint: ${name}\n`);
}

function labeledInput(label) {
  return By.xpath(`//label[span[normalize-space(.)="${label}"]]//input`);
}

async function waitForDriver(processHandle) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) {
      throw new Error(`tauri-driver exited with code ${processHandle.exitCode}`);
    }
    try {
      const response = await fetch(`${driverUrl}status`);
      if (response.ok) return;
    } catch {
      // The driver has not bound its port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('tauri-driver did not become ready within 10 seconds');
}

async function createTag(driver, name, comment) {
  const inputs = await driver.findElements(By.css('.tag-form input'));
  await setValue(inputs[0], name);
  await setValue(inputs[1], comment);
  await driver.findElement(buttonWithText('Create tag')).click();
}

async function createText(driver, { language, title, content, source, tagged = false }) {
  if ((await driver.findElements(By.css('.text-form [name="title"]'))).length === 0) {
    await driver.findElement(buttonWithText('Add content')).click();
    await visible(driver, By.css('.text-form [name="title"]'));
  }
  await setValue(await driver.findElement(By.css('[name="language"]')), language);
  await setValue(await driver.findElement(By.css('[name="title"]')), title);
  await setValue(await driver.findElement(By.css('[name="content"]')), content);
  if (source) {
    await setValue(await driver.findElement(By.css('[name="sourceUri"]')), source);
  }
  if (tagged) {
    await driver.findElement(By.css('.text-form .tag-selector input[type="checkbox"]')).click();
  }
  await driver.findElement(buttonWithText('Save to library')).click();
}

async function openLibrary(driver) {
  await driver.findElement(By.css('.view-switcher__button[aria-label="Library"]')).click();
  await visible(driver, By.xpath('//h2[normalize-space(.)="Library"]'));
}

async function openPrimaryMenuItem(driver, label) {
  await driver.findElement(By.css('summary[aria-label="Main menu"]')).click();
  await (await visible(driver, buttonWithText(label))).click();
}

test('local QA exercises the complete supported desktop workflow', { timeout: 240_000 }, async () => {
  await access(application);
  const driverCheck = spawnSync(tauriDriver, ['--help'], { encoding: 'utf8' });
  assert.equal(driverCheck.status, 0, 'tauri-driver is required');

  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'lwt-desktop-qa-'));
  const home = path.join(sandbox, 'home');
  const data = path.join(sandbox, 'data');
  const config = path.join(sandbox, 'config');
  const cache = path.join(sandbox, 'cache');
  const invalidBackup = path.join(sandbox, 'invalid-backup.json');
  const importedText = path.join(sandbox, 'qa-import.txt');
  await Promise.all([
    mkdir(path.join(home, 'Downloads'), { recursive: true }),
    mkdir(data, { recursive: true }),
    mkdir(config, { recursive: true }),
    mkdir(cache, { recursive: true }),
    mkdir(evidenceDirectory, { recursive: true }),
    writeFile(invalidBackup, '{"format":"lwt-desktop-backup","version":1,'),
    writeFile(importedText, 'Résumé café. 你好。 مرحبا.')
  ]);
  await writeFile(
    path.join(config, 'user-dirs.dirs'),
    'XDG_DOWNLOAD_DIR="$HOME/Downloads"\n'
  );

  const driverProcess = spawn(tauriDriver, [], {
    env: {
      ...process.env,
      HOME: home,
      XDG_DATA_HOME: data,
      XDG_CONFIG_HOME: config,
      XDG_CACHE_HOME: cache
    },
    cwd: home,
    stdio: 'inherit'
  });
  let driver;

  try {
    await waitForDriver(driverProcess);
    const capabilities = new Capabilities();
    capabilities.setBrowserName('wry');
    capabilities.set('tauri:options', { application });
    driver = await new Builder().withCapabilities(capabilities).usingServer(driverUrl).build();

    await visible(driver, By.xpath('//h1[normalize-space(.)="Set up the language you want to learn"]'));
    await chooseCombobox(
      driver,
      By.css('.first-language-form .language-name-control'),
      'English'
    );
    await driver.findElement(buttonWithText('Save language and add your first text')).click();
    await visible(driver, By.xpath('//h2[normalize-space(.)="Add a text"]'));
    assert.equal(
      await driver.findElement(By.css('.empty-state')).getText(),
      'Your local library is empty. Add your first text to begin.'
    );
    assert.equal(await driver.findElements(By.css('.window-control')).then((items) => items.length), 3);
    await driver.findElement(buttonWithText('Save to library')).click();
    assert.notEqual(
      await driver.findElement(By.css('[name="title"]')).getAttribute('validationMessage'),
      ''
    );
    await capture(driver, '01-empty-library.png');
    await driver.findElement(buttonWithText('Cancel')).click();
    await openPrimaryMenuItem(driver, 'Tags…');
    await visible(driver, By.xpath('//h1[normalize-space(.)="Tags"]'));
    await createTag(driver, 'Priority', 'Review first');
    await visible(driver, By.xpath('//article[contains(@class,"tag-card")]//h2[.="Priority"]'));
    await createTag(driver, 'priority', 'Duplicate');
    const duplicateError = await visible(driver, By.css('.tag-form .form-status--error'));
    assert.equal(await duplicateError.getText(), 'A tag with this name already exists.');
    checkpoint('tag creation and duplicate validation');

    await driver.findElement(By.css('.view-switcher__button[aria-label="Library"]')).click();
    await visible(driver, By.xpath('//h2[normalize-space(.)="Library"]'));
    await driver.findElement(buttonWithText('Add content')).click();
    await setValue(await driver.findElement(By.css('[name="language"]')), 'French');
    await driver
      .findElement(By.css('.text-form input[type="file"][accept*=".txt"]'))
      .sendKeys(importedText);
    await waitForText(driver, By.css('.text-form .form-status'), 'qa-import.txt loaded.');
    assert.equal(await driver.findElement(By.css('[name="title"]')).getAttribute('value'), 'qa-import');
    await driver.findElement(buttonWithText('Save to library')).click();
    const importedCard = await visible(driver, cardWithTitle('qa-import'));
    await clickCardAction(importedCard, 'Delete');
    await (await driver.wait(until.alertIsPresent(), 10_000)).accept();
    await driver.wait(async () => (await driver.findElements(cardWithTitle('qa-import'))).length === 0);

    await driver.findElement(buttonWithText('Add content')).click();
    await setValue(await driver.findElement(By.css('[name="language"]')), 'English');
    await setValue(await driver.findElement(By.css('[name="title"]')), 'Invalid URL');
    await setValue(await driver.findElement(By.css('[name="content"]')), 'Must not save.');
    await setValue(await driver.findElement(By.css('[name="sourceUri"]')), 'not a URL');
    await driver.findElement(buttonWithText('Save to library')).click();
    assert.notEqual(
      await driver.findElement(By.css('[name="sourceUri"]')).getAttribute('validationMessage'),
      ''
    );
    assert.equal((await driver.findElements(cardWithTitle('Invalid URL'))).length, 0);
    checkpoint('text file import, delete, required fields, and URL validation');

    await createText(driver, {
      language: 'English',
      title: 'QA Story',
      content: 'Hello world. Hello again. Café 你好 مرحبا.',
      source: 'https://example.com/story',
      tagged: true
    });
    await visible(driver, cardWithTitle('QA Story')).catch(async (error) => {
      const status = await driver.findElement(By.css('.text-form .form-status')).getText();
      throw new Error(`QA Story was not created. Form status: ${status}`, { cause: error });
    });
    checkpoint('text creation with tag');
    const preservedCard = await visible(driver, cardWithTitle('QA Story'));
    await clickCardAction(preservedCard, 'Edit');
    await setValue(
      await driver.findElement(By.css('[name="content"]')),
      'Hello world. Hello again. Fresh line. Café 你好 مرحبا.'
    );
    await setValue(
      await driver.findElement(By.css('[name="sourceUri"]')),
      'https://example.com/updated-story'
    );
    await driver.findElement(buttonWithText('Save changes')).click();
    await waitForText(driver, By.css('.library-feedback'), '“QA Story” was updated.');
    const editedCard = await visible(driver, cardWithTitle('QA Story'));
    await clickCardAction(editedCard, 'Edit');
    assert.equal(
      await driver.findElement(By.css('[name="sourceUri"]')).getAttribute('value'),
      'https://example.com/updated-story'
    );
    await driver.findElement(buttonWithText('Cancel editing')).click();
    const updatedCard = await visible(driver, cardWithTitle('QA Story'));
    await updatedCard.findElement(buttonWithinText('Open text')).click();
    await visible(
      driver,
      By.xpath('//article[contains(@class,"reading-content")]//button[normalize-space(.)="Fresh"]')
    );
    checkpoint('text editing and reparsing');
    const lessonActions = await driver.findElements(By.css('.finish-lesson'));
    assert.equal(lessonActions.length, 1);
    assert.equal(
      await driver.findElement(By.css('.finish-lesson--sidebar .adw-icon')).isDisplayed(),
      true
    );
    await driver.findElement(By.css('.finish-lesson--sidebar')).click();
    await visible(driver, By.xpath('//button[normalize-space(.)="Lesson finished"]'));
    await waitForText(driver, By.css('.completion-notice'), 'set to Well Known');
    await capture(driver, '02-reader-finish.png');
    await driver.findElement(buttonWithText('Undo')).click();
    const completionNotice = await waitForText(
      driver,
      By.css('.completion-notice'),
      'Lesson completion undone.'
    );
    await driver.wait(until.elementIsNotVisible(completionNotice), 3_000);
    checkpoint('one-click lesson completion and undo');

    const hello = await driver.findElement(
      By.xpath('(//article[contains(@class,"reading-content")]//button[normalize-space(.)="Hello"])[1]')
    );
    await hello.click();
    await visible(driver, By.css('.term-editor__form'));
    await chooseCombobox(
      driver,
      By.css('.term-editor__form .app-combobox'),
      'Known'
    );
    await setValue(
      await driver.findElement(By.css('.term-editor__form textarea')),
      'olá'
    );
    await setValue(
      await driver.findElement(By.css('.term-editor__form input:not([type="checkbox"])')),
      'hello'
    );
    await driver
      .findElement(By.css('.term-editor__form .tag-selector input[type="checkbox"]'))
      .click();
    await driver.findElement(buttonWithText('Save term')).click();
    await waitForText(driver, By.css('.term-editor .form-status'), 'Term saved.');
    const helloOccurrences = await driver.findElements(
      By.xpath('//article[contains(@class,"reading-content")]//button[normalize-space(.)="Hello"]')
    );
    assert.equal(helloOccurrences.length, 2);
    assert.deepEqual(
      await Promise.all(helloOccurrences.map((element) => element.getAttribute('data-status'))),
      ['5', '5']
    );
    assert.match(
      await driver.findElement(By.css('.reading-progress-label')).getText(),
      /^1 of \d+ unique terms known$/
    );

    await driver.findElement(buttonWithText('Reset to unknown')).click();
    await waitForText(driver, By.css('.term-editor .form-status'), 'Term reset to unknown.');
    assert.deepEqual(
      await Promise.all(helloOccurrences.map((element) => element.getAttribute('data-status'))),
      ['0', '0']
    );
    assert.equal(await driver.findElement(By.css('.term-editor__form textarea')).getAttribute('value'), '');
    await setValue(
      await driver.findElement(By.css('.term-editor__form textarea')),
      'olá'
    );
    await setValue(
      await driver.findElement(By.css('.term-editor__form input:not([type="checkbox"])')),
      'hello'
    );
    await driver
      .findElement(By.css('.term-editor__form .tag-selector input[type="checkbox"]'))
      .click();
    await driver.findElement(buttonWithText('Save term')).click();
    await waitForText(driver, By.css('.term-editor .form-status'), 'Term saved.');

    await driver.findElement(buttonWithText('Create expression')).click();
    await helloOccurrences[0].click();
    await driver
      .findElement(
        By.xpath('//article[contains(@class,"reading-content")]//button[normalize-space(.)="world"]')
      )
      .click();
    await waitForText(driver, By.css('.expression-controls span'), 'Expression “Hello world” created.');
    assert.equal(
      await driver.findElement(By.css('.expression-list button')).getText(),
      'Hello world'
    );
    checkpoint('term details, reset, progress, tags, and expression');

    await openLibrary(driver);
    await driver.findElement(By.css('.headerbar-language')).click();
    await visible(driver, By.xpath('//h1[normalize-space(.)="Language settings"]'));
    await driver.findElement(buttonWithText('Add language')).click();
    const addLanguageDialog = await visible(driver, By.css('.language-add-dialog'));
    const languageCombobox = await addLanguageDialog.findElement(
      By.css('.language-name-trigger')
    );
    await languageCombobox.sendKeys(Key.ARROW_DOWN);
    const languageMenu = await visible(driver, By.css('.language-name-menu'));
    assert.match(
      await languageMenu.getCssValue('background-color'),
      /255,\s*255,\s*255/
    );
    assert.ok(Number(await languageMenu.getCssValue('z-index')) >= 1000);
    const focusedLanguageOption = await driver.switchTo().activeElement();
    assert.equal(await focusedLanguageOption.getAttribute('role'), 'option');
    await focusedLanguageOption.sendKeys(Key.END, Key.ESCAPE);
    assert.equal(await languageCombobox.getAttribute('aria-expanded'), 'false');
    await chooseCombobox(
      driver,
      By.css('.language-add-form .language-name-control'),
      'Other language…'
    );
    await setValue(
      await addLanguageDialog.findElement(By.css('[name="customLanguage"]')),
      'Spanish QA'
    );
    await setValue(
      await addLanguageDialog.findElement(
        labeledInput('Primary dictionary URL (optional)')
      ),
      'https://spanish.example/?q=###'
    );
    await addLanguageDialog.findElement(By.css('button[type="submit"]')).click();
    await driver.wait(
      async () =>
        driver.executeScript(
          `return document.querySelector('.language-picker select')
            ?.selectedOptions[0]?.textContent?.startsWith('Spanish QA') ?? false;`
        ),
      10_000
    );
    await driver.executeScript(
      `const select = document.querySelector('.language-picker select');
       const english = [...select.options].find((option) =>
         option.textContent?.startsWith('English')
       );
       if (!english) throw new Error('English language option was not found');
       select.value = english.value;
       select.dispatchEvent(new Event('change', { bubbles: true }));`
    );
    await visible(
      driver,
      By.xpath('//form[contains(@class,"language-card")][.//h2[normalize-space(.)="English"]]')
    );
    await setValue(
      await driver.findElement(labeledInput('Character substitutions')),
      'invalid'
    );
    await driver.findElement(buttonWithText('Save settings')).click();
    assert.equal(
      await waitForText(
        driver,
        By.css('.language-card .form-status--error'),
        'Character substitutions'
      ).then((element) => element.getText()),
      'Character substitutions must use from=to pairs'
    );
    await setValue(
      await driver.findElement(labeledInput('Primary dictionary URL template')),
      'https://dictionary.example/?q=###'
    );
    await setValue(
      await driver.findElement(labeledInput('Translation URL template')),
      'https://translate.example/?text=###'
    );
    await setValue(await driver.findElement(labeledInput('Reading text size (%)')), '125');
    await setValue(
      await driver.findElement(labeledInput('Character substitutions')),
      "´='"
    );
    const languageOptions = await driver.findElements(
      By.css('.language-card .language-options input[type="checkbox"]')
    );
    await setChecked(languageOptions[1], true);
    await setChecked(languageOptions[2], true);
    await driver.findElement(buttonWithText('Save settings')).click();
    await waitForText(driver, By.css('.language-card .form-status'), 'Language settings saved.');
    await driver.executeScript(
      'document.querySelector(".adw-workspace").scrollTop = 0;'
    );
    await capture(driver, '02-language-settings.png');

    await openLibrary(driver);
    const configuredCard = await visible(driver, cardWithTitle('QA Story'));
    await configuredCard.findElement(buttonWithinText('Open text')).click();
    const configuredReading = await visible(driver, By.css('.reading-content'));
    assert.equal(await configuredReading.getAttribute('dir'), 'rtl');
    assert.equal(await configuredReading.getCssValue('font-size'), '20px');
    await driver
      .findElement(
        By.xpath('(//article[contains(@class,"reading-content")]//button[normalize-space(.)="Hello"])[1]')
      )
      .click();
    await visible(driver, By.linkText('Dictionary 1'));
    assert.equal(
      await driver.findElement(By.linkText('Dictionary 1')).getAttribute('href'),
      'https://dictionary.example/?q=hello'
    );
    assert.equal(
      await driver.findElement(By.linkText('Translate')).getAttribute('href'),
      'https://translate.example/?text=hello'
    );
    checkpoint('language validation, parsing, RTL, text size, and lookups');

    await openLibrary(driver);
    const archiveCard = await visible(driver, cardWithTitle('QA Story'));
    await clickCardAction(archiveCard, 'Archive');
    await (await driver.wait(until.alertIsPresent(), 10_000)).dismiss();
    await visible(driver, cardWithTitle('QA Story'));
    await clickCardAction(archiveCard, 'Archive');
    await (await driver.wait(until.alertIsPresent(), 10_000)).accept();
    await driver.wait(async () => (await driver.findElements(cardWithTitle('QA Story'))).length === 0);
    await driver.findElement(buttonWithText('Archive (1)')).click();
    const archivedCard = await visible(driver, cardWithTitle('QA Story'));
    await clickCardAction(archivedCard, 'Restore to library');
    await (await driver.wait(until.alertIsPresent(), 10_000)).accept();
    await visible(driver, By.css('.empty-state'));
    await driver.findElement(buttonWithText('Library (1)')).click();
    await visible(driver, cardWithTitle('QA Story'));
    checkpoint('archive cancel, archive, and restore');

    await openPrimaryMenuItem(driver, 'Preferences…');
    await visible(driver, By.xpath('//h1[normalize-space(.)="Application settings"]'));
    await setValue(await driver.findElement(labeledInput('Active texts per page')), '5');
    await setValue(await driver.findElement(labeledInput('Archived texts per page')), '5');
    await setValue(await driver.findElement(labeledInput('Tags per page')), '5');
    await setValue(
      await driver.findElement(labeledInput('Pause after a review rating (seconds)')),
      '0'
    );
    await setChecked(
      await driver.findElement(By.css('.settings-checkbox input[type="checkbox"]')),
      false
    );
    await driver.findElement(buttonWithText('Save settings')).click();
    await waitForText(driver, By.css('.settings-card .form-status'), 'Application settings saved.');
    await openLibrary(driver);
    checkpoint('application settings and validation constraints');

    for (let index = 1; index <= 5; index += 1) {
      const title = `Extra ${index}`;
      await createText(driver, {
        language: 'English',
        title,
        content:
          index === 1
            ? 'Hello another term.'
            : index === 2
              ? 'Disposable practice term.'
              : `Disposable text number ${index}.`
      });
      if (index < 5) {
        await visible(driver, cardWithTitle(title));
      }
      checkpoint(`created paginated text ${index}`);
    }
    await visible(driver, By.xpath('//nav[@aria-label="Pagination"]//span[.="Page 1 of 2"]'));
    if ((await driver.findElements(cardWithTitle('Extra 1'))).length === 0) {
      await driver.findElement(buttonWithText('Next →')).click();
    }
    let sharedCard = await driver.findElement(cardWithTitle('Extra 1'));
    await sharedCard.findElement(buttonWithinText('Open text')).click();
    const sharedHello = await visible(
      driver,
      By.xpath('//article[contains(@class,"reading-content")]//button[normalize-space(.)="Hello"]')
    );
    assert.equal(await sharedHello.getAttribute('data-status'), '1');
    await sharedHello.click();
    await visible(driver, By.css('.term-editor__form'));
    assert.equal(await driver.findElement(By.css('.term-editor__form textarea')).getAttribute('value'), 'olá');
    checkpoint('shared term details across texts');
    await clickReadingTerm(driver, 'another');
    await visible(driver, By.xpath('//section[contains(@class,"term-editor")]//h2[.="another"]'));
    await setDomValue(driver, '.term-editor__form textarea', 'outro').catch((error) => {
      throw new Error('Unable to fill the additional learning term', { cause: error });
    });
    await driver.findElement(buttonWithText('Save term')).click().catch((error) => {
      throw new Error('Unable to submit the additional learning term', { cause: error });
    });
    await waitForText(driver, By.css('.term-editor .form-status'), 'Term saved.').catch(
      (error) => {
        throw new Error('The additional learning term was not saved', { cause: error });
      }
    );
    checkpoint('additional learning term');
    await clickReadingTerm(driver, 'term');
    await visible(driver, By.xpath('//section[contains(@class,"term-editor")]//h2[.="term"]'));
    await chooseCombobox(
      driver,
      By.css('.term-editor__form .app-combobox'),
      'Ignored'
    );
    await driver.findElement(buttonWithText('Save term')).click();
    await waitForText(driver, By.css('.term-editor .form-status'), 'Term saved.');
    assert.equal(
      await driver
        .findElement(
          By.xpath('//article[contains(@class,"reading-content")]//button[normalize-space(.)="term"]')
        )
        .getAttribute('data-status'),
      '98'
    );
    checkpoint('ignored term state');
    await openLibrary(driver);

    sharedCard = await driver.findElement(cardWithTitle('Extra 2'));
    await sharedCard.findElement(buttonWithinText('Open text')).click();
    await clickReadingTerm(driver, 'Disposable');
    await visible(driver, By.xpath('//section[contains(@class,"term-editor")]//h2[.="Disposable"]'));
    await setDomValue(driver, '.term-editor__form textarea', 'descartável');
    await driver.findElement(buttonWithText('Save term')).click();
    await waitForText(driver, By.css('.term-editor .form-status'), 'Term saved.');
    checkpoint('fourth review term');
    await openLibrary(driver);
    if ((await driver.findElements(By.xpath('//nav[@aria-label="Pagination"]//span[.="Page 2 of 2"]'))).length > 0) {
      await driver.findElement(buttonWithText('← Previous')).click();
    }
    await visible(driver, By.xpath('//nav[@aria-label="Pagination"]//span[.="Page 1 of 2"]'));
    assert.equal(
      await driver.findElement(cardWithTitle('Extra 4')).findElement(By.css('.text-card__details')).getText(),
      'Word counts hidden in Settings'
    );
    const disposableCard = await visible(driver, cardWithTitle('Extra 5'));
    await clickCardAction(disposableCard, 'Delete');
    await (await driver.wait(until.alertIsPresent(), 10_000)).dismiss();
    await visible(driver, cardWithTitle('Extra 5'));
    await clickCardAction(disposableCard, 'Delete');
    await (await driver.wait(until.alertIsPresent(), 10_000)).accept();
    await driver.wait(async () => (await driver.findElements(cardWithTitle('Extra 5'))).length === 0);
    assert.equal((await driver.findElements(By.css('nav.pager'))).length, 0);
    checkpoint('settings, pagination, delete cancel, and delete');

    await driver.findElement(By.css('.view-switcher__button[aria-label="Vocabulary"]')).click();
    await visible(driver, By.xpath('//h1[normalize-space(.)="Words and expressions"]'));
    const helloVocabularyRow = await visible(
      driver,
      By.xpath('//table[contains(@class,"term-table")]//tr[.//strong[.="Hello"]]')
    );
    assert.equal(
      await helloVocabularyRow.findElement(By.css('.term-context mark')).getText(),
      'Hello'
    );
    assert.notEqual(
      (await helloVocabularyRow.findElement(By.css('.term-context > span')).getText()).trim(),
      ''
    );
    await capture(driver, '03-vocabulary.png');
    await helloVocabularyRow.findElement(By.css('button[aria-label="Edit Hello"]')).click();
    const vocabularyDialog = await visible(driver, By.css('.vocabulary-editor-dialog'));
    assert.equal(await vocabularyDialog.findElement(By.css('h2')).getText(), 'Hello');
    await vocabularyDialog.findElement(buttonWithinText('Cancel')).click();
    checkpoint('vocabulary inventory, context, and editor');

    await driver.findElement(By.css('.view-switcher__button[aria-label="Review"]')).click();
    await visible(driver, By.css('.review-header'));
    assert.equal(await driver.findElement(By.css('.review-card h2')).getText(), 'Hello');
    const reviewCount = Number(
      (await driver.findElement(By.css('.review-counter')).getText()).split(' of ')[1]
    );
    assert.equal(reviewCount, 4);
    const ratings = ['Again', 'Hard', 'Good', 'Easy'];
    for (let index = 0; index < reviewCount; index += 1) {
      await visible(driver, buttonWithText('Show answer'));
      if (index === 0) {
        await driver.findElement(By.css('body')).sendKeys(Key.SPACE);
      } else {
        await driver.findElement(buttonWithText('Show answer')).click();
      }
      if (index === 0) {
        assert.equal(await driver.findElement(By.css('.review-answer p')).getText(), 'olá');
        await capture(driver, '04-review-context.png');
      }
      if (index === 0) {
        await driver.findElement(By.css('body')).sendKeys('1');
      } else {
        await driver.findElement(buttonWithText(ratings[index])).click();
      }
    }
    await visible(driver, By.xpath('//h2[normalize-space(.)="Review complete"]'));
    await openLibrary(driver);
    await driver.findElement(By.css('.view-switcher__button[aria-label="Review"]')).click();
    await visible(driver, By.xpath('//h2[normalize-space(.)="No terms are due"]'));
    checkpoint('review queue and ratings');

    await openLibrary(driver);
    await openPrimaryMenuItem(driver, 'Statistics');
    await visible(driver, By.xpath('//h1[normalize-space(.)="Learning statistics"]'));
    assert.equal(
      await driver
        .findElement(By.xpath('//article[span[normalize-space(.)="Reviews today"]]/strong'))
        .getText(),
      String(reviewCount)
    );
    assert.equal(
      await driver
        .findElement(By.xpath('//article[span[normalize-space(.)="Accuracy today"]]/strong'))
        .getText(),
      '50%'
    );
    await capture(driver, '05-statistics.png');
    await openLibrary(driver);
    await openPrimaryMenuItem(driver, 'Tags…');
    for (let index = 1; index <= 5; index += 1) {
      await createTag(driver, `Tag ${index}`, `QA tag ${index}`);
      await waitForText(driver, By.css('.tag-form .form-status'), `Tag “Tag ${index}” created.`);
    }
    await visible(driver, By.xpath('//nav[@aria-label="Pagination"]//span[.="Page 1 of 2"]'));
    let priorityCard = await visible(
      driver,
      By.xpath('//article[contains(@class,"tag-card")][.//h2[.="Priority"]]')
    );
    assert.equal(await priorityCard.findElement(By.css('p:last-child')).getText(), '1 texts · 1 terms');
    await driver.findElement(buttonWithText('Next →')).click();
    await visible(driver, By.xpath('//article[contains(@class,"tag-card")]//h2[.="Tag 5"]'));
    await driver.findElement(buttonWithText('← Previous')).click();
    priorityCard = await visible(
      driver,
      By.xpath('//article[contains(@class,"tag-card")][.//h2[.="Priority"]]')
    );
    checkpoint('statistics and tag counts');

    await openLibrary(driver);
    await driver.findElement(By.css('body')).sendKeys(Key.TAB);
    assert.equal(
      await driver.executeScript('return document.activeElement?.tagName;'),
      'SUMMARY'
    );
    await driver.executeScript('document.documentElement.style.zoom = "200%";');
    await driver.findElement(By.css('summary[aria-label="Main menu"]')).click();
    assert.equal(await driver.findElement(buttonWithText('Preferences…')).isDisplayed(), true);
    await driver.executeScript('document.documentElement.style.zoom = "100%";');
    checkpoint('keyboard focus and 200 percent zoom');

    await driver.quit();
    driver = undefined;
    driver = await new Builder().withCapabilities(capabilities).usingServer(driverUrl).build();
    checkpoint('application relaunched');
    await (await visible(driver, buttonWithText('Library'))).click();
    checkpoint('relaunch library opened');
    const relaunchedCard = await visible(driver, cardWithTitle('QA Story'));
    await relaunchedCard.findElement(buttonWithinText('Open text')).click();
    await visible(driver, By.xpath('//h1[normalize-space(.)="QA Story"]'));
    checkpoint('relaunch content restored');
    await openLibrary(driver);
    await openPrimaryMenuItem(driver, 'Preferences…');
    checkpoint('relaunch preferences opened');
    assert.equal(
      await driver.findElement(labeledInput('Active texts per page')).getAttribute('value'),
      '5'
    );
    assert.equal(
      await driver.findElement(By.css('.settings-checkbox input')).isSelected(),
      false
    );
    checkpoint('application relaunch and settings persistence');

    await openLibrary(driver);
    await openPrimaryMenuItem(driver, 'Backup and Restore…');
    await visible(driver, By.xpath('//h1[normalize-space(.)="Backup and restore"]'));
    await driver.findElement(buttonWithText('Download backup')).click();
    await waitForText(driver, By.css('.data-card:first-of-type .form-status'), 'Backup downloaded.');
    const downloads = path.join(home, 'Downloads');
    await driver.wait(
      async () => (await readdir(downloads)).some((name) => name.endsWith('.json')),
      10_000
    );
    const backupName = (await readdir(downloads)).find((name) => name.endsWith('.json'));
    assert.ok(backupName);
    const exportedBackup = path.join(downloads, backupName);
    const exportedPayload = JSON.parse(await readFile(exportedBackup, 'utf8'));
    assert.equal(exportedPayload.format, 'lwt-desktop-backup');
    assert.equal(exportedPayload.texts.length, 5);
    checkpoint('isolated backup download and contents');

    await openLibrary(driver);
    await createText(driver, {
      language: 'English',
      title: 'After Backup',
      content: 'This text must disappear after restore.'
    });
    await visible(driver, cardWithTitle('After Backup'));
    await openPrimaryMenuItem(driver, 'Backup and Restore…');
    await driver.findElement(By.css('input[type="file"][accept*="json"]')).sendKeys(exportedBackup);
    await waitForText(driver, By.css('.data-card:last-of-type .form-status'), 'ready to restore');
    await driver.findElement(buttonWithText('Restore selected backup')).click();
    await (await driver.wait(until.alertIsPresent(), 10_000)).dismiss();
    await openLibrary(driver);
    await visible(driver, cardWithTitle('After Backup'));

    await openPrimaryMenuItem(driver, 'Backup and Restore…');
    await driver.findElement(By.css('input[type="file"][accept*="json"]')).sendKeys(exportedBackup);
    await waitForText(driver, By.css('.data-card:last-of-type .form-status'), 'ready to restore');
    await driver.findElement(buttonWithText('Restore selected backup')).click();
    await (await driver.wait(until.alertIsPresent(), 10_000)).accept();
    await waitForText(driver, By.css('.data-card:last-of-type .form-status'), 'Restored 5 texts');
    await openLibrary(driver);
    assert.equal((await driver.findElements(cardWithTitle('After Backup'))).length, 0);
    await visible(driver, cardWithTitle('QA Story'));
    checkpoint('restore cancel and round-trip restore');

    await openPrimaryMenuItem(driver, 'Backup and Restore…');
    await driver.findElement(By.css('input[type="file"][accept*="json"]')).sendKeys(invalidBackup);
    await waitForText(driver, By.css('.data-card:last-of-type .form-status'), 'ready to restore');
    await driver.findElement(buttonWithText('Restore selected backup')).click();
    await (await driver.wait(until.alertIsPresent(), 10_000)).accept();
    await visible(driver, By.css('.data-card:last-of-type .form-status--error'));
    await openLibrary(driver);
    await visible(driver, cardWithTitle('QA Story'));
    checkpoint('invalid backup rollback');

    await openPrimaryMenuItem(driver, 'Backup and Restore…');
    await driver.findElement(By.css('input[type="file"][accept*="json"]')).sendKeys(legacyBackup);
    await waitForText(driver, By.css('.data-card:last-of-type .form-status'), 'ready to restore');
    await driver.findElement(buttonWithText('Restore selected backup')).click();
    await (await driver.wait(until.alertIsPresent(), 10_000)).accept();
    await waitForText(driver, By.css('.data-card:last-of-type .form-status'), 'Restored 2 texts');
    await openLibrary(driver);
    await visible(driver, cardWithTitle('Legacy text'));
    assert.equal((await driver.findElements(cardWithTitle('QA Story'))).length, 0);
    checkpoint('legacy backup restore');
  } finally {
    if (driver) await driver.quit().catch(() => undefined);
    if (driverProcess.exitCode === null) {
      driverProcess.kill();
      await Promise.race([
        once(driverProcess, 'exit'),
        new Promise((resolve) => setTimeout(resolve, 2_000))
      ]);
    }
    await rm(sandbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
