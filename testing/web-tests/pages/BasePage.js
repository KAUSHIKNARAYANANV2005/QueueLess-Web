import { By, until } from 'selenium-webdriver';
import { config } from '../config/test.config.js';

export class BasePage {
  constructor(driver) {
    this.driver = driver;
  }

  async navigate(path) {
    let formattedPath = path;
    if (path.startsWith('/') && !path.startsWith('/#')) {
      formattedPath = `/#${path}`;
    }
    const url = `${config.baseUrl}${formattedPath}`;
    
    if (path.includes('/login')) {
      try {
        await this.driver.executeScript('localStorage.clear(); sessionStorage.clear();');
      } catch (err) {
        // Ignore if storage is not accessible on initial load
      }
      await this.driver.get(url);
      try {
        await this.driver.navigate().refresh();
        await this.driver.sleep(1000);
      } catch (err) {
        // Ignore
      }
    } else {
      await this.driver.get(url);
    }
  }

  async waitForPageLoaded(timeout = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const splashPresent = await this.isElementPresent(By.css('.splash-screen-root'), 400);
      const authLoadingPresent = await this.isElementPresent(By.css('.auth-loading-root'), 400);
      if (!splashPresent && !authLoadingPresent) {
        break;
      }
      await this.driver.sleep(400);
    }
    await this.driver.sleep(800); // Allow react rendering and transition to settle
  }

  async findElement(locator, timeout = config.timeouts.explicit) {
    return await this.driver.wait(until.elementLocated(locator), timeout);
  }

  async findElements(locator) {
    return await this.driver.findElements(locator);
  }

  async waitForElementVisible(locator, timeout = config.timeouts.explicit) {
    const element = await this.findElement(locator, timeout);
    await this.driver.wait(until.elementIsVisible(element), timeout);
    return element;
  }

  async waitForElement(locator, timeout = config.timeouts.explicit) {
    return await this.waitForElementVisible(locator, timeout);
  }

  async click(locator, timeout = config.timeouts.explicit) {
    const element = await this.waitForElementVisible(locator, timeout);
    await element.click();
  }

  async write(locator, text, timeout = config.timeouts.explicit) {
    const element = await this.waitForElementVisible(locator, timeout);
    await element.clear();
    await element.sendKeys(text);
  }

  async getText(locator, timeout = config.timeouts.explicit) {
    const element = await this.waitForElementVisible(locator, timeout);
    return await element.getText();
  }

  async isElementPresent(locator, timeout = 2000) {
    try {
      await this.driver.wait(until.elementLocated(locator), timeout);
      return true;
    } catch (err) {
      return false;
    }
  }

  async getCurrentUrl() {
    return await this.driver.getCurrentUrl();
  }
}
