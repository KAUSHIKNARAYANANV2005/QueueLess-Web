import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class CustomerHomePage extends BasePage {
  constructor(driver) {
    super(driver);
    this.searchBar = By.css('input[placeholder*="Search"]');
    this.categoryPills = By.css('.category-pill, .filter-pill');
    this.businessCards = By.css('.business-card, .shop-card');
    this.emptyState = By.css('.empty-state, .no-results');
    this.personalizedGreeting = By.css('.welcome-greeting, h1');
  }

  async searchBusiness(name) {
    await this.write(this.searchBar, name);
  }

  async filterByCategory(category) {
    const pills = await this.findElements(this.categoryPills);
    for (const pill of pills) {
      const text = await pill.getText();
      if (text.toLowerCase().includes(category.toLowerCase())) {
        await pill.click();
        break;
      }
    }
  }

  async getBusinessCardCount() {
    const cards = await this.findElements(this.businessCards);
    return cards.length;
  }
}
