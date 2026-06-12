import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class CommonPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.themeToggle = By.css('.nav-icon-btn[aria-label*="theme"], button[aria-label*="theme"]');
    this.bellBtn = By.css('.nav-icon-btn[aria-label*="Notifications"], button[aria-label*="Notifications"]');
    this.notifBadge = By.css('.notif-badge');
    this.avatarDropdownBtn = By.css('.user-profile-avatar, button[aria-label*="profile"]');
    this.logoutBtn = By.css('.avatar-dropdown-menu button, li button[class*="logout"]');
    
    // Toast notification alerts
    this.toastAlert = By.css('.toast, .cp-toast, .alert-success, .alert-error');
  }

  async toggleThemeMode() {
    await this.click(this.themeToggle);
  }

  async logoutUser() {
    await this.click(this.avatarDropdownBtn);
    await this.click(this.logoutBtn);
  }
}
