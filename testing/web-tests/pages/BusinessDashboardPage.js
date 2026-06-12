import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class BusinessDashboardPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.statsCards = By.css('.stat-card, .metric-card');
    
    // Services selectors
    this.addServiceBtn = By.css('.add-service-btn, button[class*="add"]');
    this.serviceNameInput = By.css('input[name="name"], #service-name');
    this.servicePriceInput = By.css('input[name="price"], #service-price');
    this.serviceDurationInput = By.css('input[name="durationMinutes"], #service-duration');
    this.saveServiceBtn = By.css('.save-service-btn, button[type="submit"]');
    this.serviceRow = By.css('.service-card, .service-item');
    
    // Staff selectors
    this.addStaffBtn = By.css('.add-staff-btn');
    this.staffNameInput = By.css('input[name="name"], #staff-name');
    this.staffRoleSelect = By.css('select[name="role"], #staff-role');
    this.saveStaffBtn = By.css('.save-staff-btn');
    this.staffCard = By.css('.staff-card');
    
    // Settings selectors
    this.mondayToggle = By.css('#monday-toggle, input[name*="monday"]');
    this.saveSettingsBtn = By.css('.save-settings-btn, button[type="submit"]');
    this.validationBanner = By.css('.settings-error, .validation-banner');
  }

  async navigateToTab(tabName) {
    // Navigates by sidebar links
    const sidebarLink = By.xpath(`//a[contains(text(), '${tabName}')] | //span[contains(text(), '${tabName}')]`);
    await this.click(sidebarLink);
  }
}
