import assert from 'node:assert/strict';
import { access, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { Builder, By, Capabilities, until } from 'selenium-webdriver';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const application =
  process.env.LWT_E2E_BINARY ??
  path.join(
    repositoryRoot,
    'desktop',
    'src-tauri',
    'target',
    'debug',
    process.platform === 'win32' ? 'lwt-desktop.exe' : 'lwt-desktop'
  );
const legacyBackup = path.join(
  repositoryRoot,
  'desktop',
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

async function visible(driver, locator, timeout = 10_000) {
  const element = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(element), timeout);
  return element;
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

  const appDataDirectory = await mkdtemp(path.join(os.tmpdir(), 'lwt-desktop-e2e-'));
  const driverProcess = spawn(tauriDriver, [], {
    env: { ...process.env, XDG_DATA_HOME: appDataDirectory },
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
    assert.equal(await heading.getText(), 'Learning with Texts');
    assert.match(await driver.findElement(By.css('.app-header p')).getText(), /local SQLite mode/);
    assert.equal(
      await driver.findElement(By.css('.empty-state')).getText(),
      'Your local library is empty. Use the form above to add a text.'
    );

    await driver.findElement(By.css('[name="language"]')).sendKeys('English');
    await driver.findElement(By.css('[name="title"]')).sendKeys('E2E Story');
    await driver
      .findElement(By.css('[name="content"]'))
      .sendKeys('Hello world. Hello again.');
    await driver.findElement(buttonWithText('Save to library')).click();
    await visible(
      driver,
      By.xpath('//article[contains(@class,"text-card")][.//h2[normalize-space(.)="E2E Story"]]')
    );

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

    await driver.findElement(buttonWithText('← Back to library')).click();
    await visible(driver, buttonWithText('Review terms'));
    await driver.findElement(buttonWithText('Review terms')).click();
    await visible(driver, By.xpath('//h1[normalize-space(.)="Review terms"]'));
    assert.equal(await driver.findElement(By.css('.review-card h2')).getText(), 'Hello');
    await driver.findElement(buttonWithText('Show answer')).click();
    assert.equal(await driver.findElement(By.css('.review-answer p')).getText(), 'olá');
    await driver.findElement(buttonWithText('Good')).click();
    await visible(driver, By.xpath('//h2[normalize-space(.)="Review complete"]'));

    await driver.findElement(buttonWithText('← Back to library')).click();
    await visible(driver, buttonWithText('Statistics'));
    await driver.findElement(buttonWithText('Statistics')).click();
    await visible(driver, By.xpath('//h1[normalize-space(.)="Learning statistics"]'));
    assert.equal(
      await driver
        .findElement(By.xpath('//article[span[normalize-space(.)="Reviews today"]]/strong'))
        .getText(),
      '1'
    );

    await driver.findElement(buttonWithText('← Back to library')).click();
    await visible(driver, buttonWithText('Backup'));
    await driver.findElement(buttonWithText('Backup')).click();
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

    await driver.findElement(buttonWithText('← Back to library')).click();
    await visible(driver, By.xpath('//h2[normalize-space(.)="Legacy text"]'));
    assert.equal(
      await driver.findElements(By.xpath('//h2[normalize-space(.)="E2E Story"]')).then((items) => items.length),
      0
    );
  } finally {
    if (driver) await driver.quit().catch(() => undefined);
    driverProcess.kill();
    await rm(appDataDirectory, { recursive: true, force: true });
  }
});
