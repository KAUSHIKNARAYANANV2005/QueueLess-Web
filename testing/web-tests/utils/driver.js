import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { config } from '../config/test.config.js';

export async function createDriver() {
  const options = new chrome.Options();
  
  if (config.headless) {
    options.addArguments('--headless=new');
  }
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--window-size=1280,800');
  options.addArguments('--log-level=3');
  options.addArguments('--silent');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  await driver.manage().setTimeouts({ implicit: config.timeouts.implicit });
  return driver;
}
