import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

export class BookingFlowPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.serviceSelectBtn = By.css('.service-select-btn, .btn-select-service');
    this.staffSelectCard = By.css('.staff-select-card');
    this.continueBtn = By.css('.continue-booking-btn, .btn-primary');
    
    // DateTime selectors
    this.dateCarouselDay = By.css('.date-carousel-item, .carousel-day');
    this.timeSlotBtn = By.css('.time-slot-btn, .slot-item');
    
    // Checkout confirmation
    this.payAtVenueBtn = By.css('.pay-venue-btn, .btn-primary');
    this.tokenDisplay = By.css('.token-display-number, .queue-token');
    this.queuePositionText = By.css('.queue-position-value, .live-position');
    
    // Cancellation
    this.cancelBookingBtn = By.css('.cancel-booking-btn, .btn-danger');
  }

  async selectFirstServiceAndStaff() {
    await this.click(this.serviceSelectBtn);
    if (await this.isElementPresent(this.staffSelectCard)) {
      await this.click(this.staffSelectCard);
    }
    await this.click(this.continueBtn);
  }

  async pickDateAndTimeSlot() {
    await this.click(this.dateCarouselDay);
    await this.click(this.timeSlotBtn);
    await this.click(this.continueBtn);
  }

  async checkoutPayAtVenue() {
    await this.click(this.payAtVenueBtn);
  }
}
