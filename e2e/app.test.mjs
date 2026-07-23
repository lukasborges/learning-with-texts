import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { Builder, By, Capabilities, until } from 'selenium-webdriver';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const application =
  process.env.LWT_E2E_BINARY ??
  path.join(
    repositoryRoot,
    'target',
    'debug',
    process.platform === 'win32' ? 'lwt-desktop.exe' : 'lwt-desktop'
  );
const legacyBackup = path.join(
  repositoryRoot,
  'tests',
  'fixtures',
  'legacy-backup-v1.json'
);
const driverUrl = 'http://127.0.0.1:4444/';
const tauriDriver =
  process.env.TAURI_DRIVER ??
  path.join(
    os.homedir(),
    '.cargo',
    'bin',
    process.platform === 'win32' ? 'tauri-driver.exe' : 'tauri-driver'
  );

function buttonWithText(text) {
  return By.xpath(`//button[normalize-space(.)="${text}"]`);
}

function checkpoint(name) {
  process.stderr.write(`# Smoke checkpoint: ${name}\n`);
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
  }, timeout, `Visible element was not found: ${locator}`);
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

async function openPrimaryMenuItem(driver, label) {
  await driver.findElement(By.css('summary[aria-label="Main menu"]')).click();
  await (await visible(driver, buttonWithText(label))).click();
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

test('packaged desktop workflows persist and restore local data', { timeout: 120_000 }, async () => {
  await access(application);
  await access(legacyBackup);
  const driverCheck = spawnSync(tauriDriver, ['--help'], { encoding: 'utf8' });
  assert.equal(
    driverCheck.status,
    0,
    'tauri-driver is required; install it with `cargo install tauri-driver --locked`'
  );

  const sandboxDirectory = await mkdtemp(path.join(os.tmpdir(), 'lwt-desktop-e2e-'));
  const homeDirectory = path.join(sandboxDirectory, 'home');
  const appDataDirectory = path.join(sandboxDirectory, 'data');
  const configDirectory = path.join(sandboxDirectory, 'config');
  const cacheDirectory = path.join(sandboxDirectory, 'cache');
  await Promise.all([
    mkdir(path.join(homeDirectory, 'Downloads'), { recursive: true }),
    mkdir(appDataDirectory, { recursive: true }),
    mkdir(configDirectory, { recursive: true }),
    mkdir(cacheDirectory, { recursive: true })
  ]);
  await writeFile(
    path.join(configDirectory, 'user-dirs.dirs'),
    'XDG_DOWNLOAD_DIR="$HOME/Downloads"\n'
  );
  const driverProcess = spawn(tauriDriver, [], {
    env: {
      ...process.env,
      HOME: homeDirectory,
      XDG_DATA_HOME: appDataDirectory,
      XDG_CONFIG_HOME: configDirectory,
      XDG_CACHE_HOME: cacheDirectory
    },
    cwd: homeDirectory,
    stdio: 'inherit'
  });
  let driver;

  try {
    await waitForDriver(driverProcess);
    const capabilities = new Capabilities();
    capabilities.setBrowserName('wry');
    capabilities.set('tauri:options', { application });
    driver = await new Builder()
      .withCapabilities(capabilities)
      .usingServer(driverUrl)
      .build();

    const heading = await visible(driver, By.css('h1'));
    assert.equal(await heading.getText(), 'Set up the language you want to learn');
    assert.equal(await driver.findElements(By.css('.window-control')).then((items) => items.length), 3);
    assert.equal(
      await driver.findElements(By.css('.window-resize-handle')).then((items) => items.length),
      8
    );
    assert.equal(
      await driver.findElement(By.css('.window-control[aria-label="Maximize window"]')).isDisplayed(),
      true
    );
    assert.ok(
      (await driver.findElements(By.css('.adw-headerbar svg.adw-icon path'))).length >= 8
    );
    assert.equal(
      (await driver.findElements(By.css('.adw-headerbar img.adw-icon'))).length,
      0
    );
    checkpoint('first-use shell');
    await chooseCombobox(
      driver,
      By.css('.first-language-form .language-name-control'),
      'English'
    );
    await driver
      .findElement(buttonWithText('Save language and add your first text'))
      .click();
    await visible(driver, By.xpath('//h2[normalize-space(.)="Add a text"]'));
    assert.equal(
      await driver.findElement(By.css('.empty-state')).getText(),
      'Your local library is empty. Add your first text to begin.'
    );
    const saveToLibrary = await driver.findElement(buttonWithText('Save to library'));
    assert.equal(
      await driver.executeScript(
        'return getComputedStyle(arguments[0]).backgroundColor',
        saveToLibrary
      ),
      'rgb(53, 132, 228)'
    );
    checkpoint('language setup');
    await driver.findElement(By.css('.tag-selector__empty-action')).click();
    await visible(driver, By.xpath('//dialog//h2[normalize-space(.)="No tags have been created"]'));
    await driver.findElement(buttonWithText('Not now')).click();

    await driver.findElement(By.css('[name="title"]')).sendKeys('E2E Story');
    await driver
      .findElement(By.css('[name="content"]'))
      .sendKeys('Hello world. Hello again.');
    await saveToLibrary.click();
    await visible(
      driver,
      By.xpath('//article[contains(@class,"text-card")][.//h2[normalize-space(.)="E2E Story"]]')
    );
    checkpoint('text creation');

    await driver
      .findElement(
        By.xpath(
          '//article[contains(@class,"text-card")][.//h2[normalize-space(.)="E2E Story"]]//button[normalize-space(.)="Open text"]'
        )
      )
      .click();
    await visible(driver, By.xpath('//h1[normalize-space(.)="E2E Story"]'));
    await driver
      .findElement(
        By.xpath(
          '(//article[contains(@class,"reading-content")]//button[normalize-space(.)="Hello"])[1]'
        )
      )
      .click();
    await visible(driver, By.css('.term-editor__form'));
    await driver.findElement(By.css('.term-editor textarea')).sendKeys('olá');
    await driver.findElement(buttonWithText('Save term')).click();
    await driver.wait(
      until.elementTextIs(await driver.findElement(By.css('.term-editor .form-status')), 'Term saved.'),
      10_000
    );
    checkpoint('term save');
    const finishLessonButton = await driver.findElement(buttonWithText('Finish lesson'));
    await driver.executeScript(
      'arguments[0].scrollIntoView({ block: "center", inline: "nearest" })',
      finishLessonButton
    );
    await finishLessonButton.click();
    await visible(driver, By.xpath('//button[normalize-space(.)="Lesson finished"]'));
    assert.match(
      await driver.findElement(By.css('.completion-notice span')).getText(),
      /set to Well Known/
    );
    await driver.findElement(buttonWithText('Undo')).click();
    await driver.wait(
      until.elementTextIs(
        await driver.findElement(By.css('.completion-notice')),
        'Lesson completion undone.'
      ),
      10_000
    );

    await driver.findElement(By.css('.view-switcher__button[aria-label="Library"]')).click();
    await visible(driver, By.xpath('//h2[normalize-space(.)="Library"]'));
    await (await visible(driver, buttonWithText('Home'))).click();
    await visible(driver, By.xpath('//h1[normalize-space(.)="Pick up where you left off"]'));
    assert.equal(await driver.findElement(By.css('.continue-card h2')).getText(), 'E2E Story');
    assert.equal(
      await driver.findElement(By.css('.recent-grid .empty-state')).getText(),
      'No other recent texts yet.'
    );
    await (await visible(driver, buttonWithText('Library'))).click();
    await (await visible(driver, buttonWithText('Vocabulary'))).click();
    await visible(driver, By.xpath('//h1[normalize-space(.)="Words and expressions"]'));
    const vocabularyRow = await visible(
      driver,
      By.xpath('//table[contains(@class,"term-table")]//tr[.//strong[.="Hello"]]')
    );
    assert.match(await vocabularyRow.findElement(By.css('.term-context')).getText(), /Hello world/);
    await vocabularyRow.findElement(By.css('button[aria-label="Edit Hello"]')).click();
    await visible(driver, By.xpath('//dialog//h2[normalize-space(.)="Hello"]'));
    await driver.findElement(buttonWithText('Cancel')).click();
    await (await visible(driver, By.css('.view-switcher__button:nth-child(4)'))).click();
    await visible(driver, By.css('.review-header'));
    assert.equal(await driver.findElement(By.css('.review-card h2')).getText(), 'Hello');
    assert.match(await driver.findElement(By.css('.review-context')).getText(), /Hello world/);
    await driver.findElement(buttonWithText('Show answer')).click();
    assert.equal(await driver.findElement(By.css('.review-answer p')).getText(), 'olá');
    await driver.findElement(buttonWithText('Good')).click();
    await visible(driver, By.xpath('//h2[normalize-space(.)="Review complete"]'));

    await driver.findElement(By.css('.view-switcher__button[aria-label="Library"]')).click();
    await visible(driver, By.xpath('//h2[normalize-space(.)="Library"]'));
    await openPrimaryMenuItem(driver, 'Statistics');
    await visible(driver, By.xpath('//h1[normalize-space(.)="Learning statistics"]'));
    assert.equal(
      await driver
        .findElement(By.xpath('//article[span[normalize-space(.)="Reviews today"]]/strong'))
        .getText(),
      '1'
    );

    await driver.findElement(By.css('.view-switcher__button[aria-label="Library"]')).click();
    await visible(driver, By.xpath('//h2[normalize-space(.)="Library"]'));
    await openPrimaryMenuItem(driver, 'Backup and Restore…');
    await visible(driver, By.xpath('//h1[normalize-space(.)="Backup and restore"]'));
    await driver.findElement(buttonWithText('Download backup')).click();
    await driver.wait(
      until.elementTextIs(
        await driver.findElement(By.css('.data-card:first-of-type .form-status')),
        'Backup downloaded.'
      ),
      10_000
    );

    const backupInput = await driver.findElement(By.css('input[type="file"][accept*="json"]'));
    await backupInput.sendKeys(legacyBackup);
    const restoreButton = await driver.findElement(buttonWithText('Restore selected backup'));
    await driver.wait(until.elementIsEnabled(restoreButton), 10_000);
    await restoreButton.click();
    const alert = await driver.wait(until.alertIsPresent(), 10_000);
    await alert.accept();
    const restoreStatus = await driver.findElement(By.css('.data-card:last-of-type .form-status'));
    await driver.wait(async () => (await restoreStatus.getText()).startsWith('Restored 2 texts'), 10_000);

    await driver.findElement(By.css('.view-switcher__button[aria-label="Library"]')).click();
    await visible(driver, By.xpath('//h2[normalize-space(.)="Legacy text"]'));
    assert.equal(
      await driver.findElements(By.xpath('//h2[normalize-space(.)="E2E Story"]')).then((items) => items.length),
      0
    );
  } finally {
    if (driver) await driver.quit().catch(() => undefined);
    if (driverProcess.exitCode === null) {
      driverProcess.kill();
      await Promise.race([
        once(driverProcess, 'exit'),
        new Promise((resolve) => setTimeout(resolve, 2_000))
      ]);
    }
    await rm(sandboxDirectory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100
    });
  }
});
