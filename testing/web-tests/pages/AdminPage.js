import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class AdminPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.adminStatsCards = By.css('.ad-stat-card, .admin-stat-card, .metric-card');
    this.shopRow = By.css('.business-moderation-row, tr.shop-item');
    this.approveToggle = By.css('.moderation-toggle, input[type="checkbox"]');
    this.exportBtn = By.css('.export-bookings-btn, button[class*="export"]');
    this.startDateInput = By.css('input[name="startDate"]');
    this.endDateInput = By.css('input[name="endDate"]');
  }
}
