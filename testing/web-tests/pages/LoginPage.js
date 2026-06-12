import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class LoginPage extends BasePage {
  constructor(driver) {
    super(driver);
    // Accurate selectors from Login.jsx DOM
    this.emailInput = By.css('input.glass-input[type="email"]');
    this.passwordInput = By.css('input.glass-input[type="password"]');
    this.loginButton = By.css('button.submit-btn[type="submit"]');
    this.errorBanner = By.css('.error-banner');
    this.errorText = By.css('.error-text');
    
    // Auth links
    this.registerCustomerLink = By.css('a[href="/register/customer"]');
    this.registerBusinessLink = By.css('a[href="/register/business"]');
    this.forgotPasswordLink = By.css('a[href="/forgot-password"]');
    this.googleLoginBtn = By.css('.google-btn');
    this.phoneLoginBtn = By.css('.phone-btn');
  }

  async login(email, password) {
    // Navigate to login and wait for page
    await this.waitForPageLoaded();
    
    if (email) {
      await this.write(this.emailInput, email);
    }
    if (password) {
      await this.write(this.passwordInput, password);
    }
    await this.click(this.loginButton);
  }

  async getErrorMessage() {
    // Error banner shows Firebase auth errors
    try {
      return await this.getText(this.errorBanner);
    } catch {
      return await this.getText(this.errorText);
    }
  }

  async isErrorVisible() {
    return await this.isElementPresent(this.errorBanner, 3000);
  }
}
