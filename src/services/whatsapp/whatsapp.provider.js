const GreenAPIService = require('./greenapi.service');
const MockWhatsAppService = require('./mock.service');

/**
 * WhatsApp Provider Factory
 * This allows easy switching between different WhatsApp services
 * (Green API, Twilio, Meta Business API, etc.)
 */
class WhatsAppProvider {
  constructor() {
    // In future, you can switch providers based on environment variable
    // For now, using Green API
    const provider =
      process.env.OTP_MOCK_MODE === 'true' ? 'mock' : process.env.WHATSAPP_PROVIDER || 'greenapi';

    switch (provider) {
      case 'mock':
        this.service = new MockWhatsAppService();
        break;
      case 'greenapi':
        this.service = new GreenAPIService();
        break;
      // Add other providers here when migrating to official API
      // case 'meta':
      //   this.service = new MetaWhatsAppService();
      //   break;
      // case 'twilio':
      //   this.service = new TwilioWhatsAppService();
      //   break;
      default:
        this.service = new GreenAPIService();
    }
  }

  /**
   * Send OTP via WhatsApp
   */
  async sendOTP(phoneNumber, otp) {
    return await this.service.sendOTP(phoneNumber, otp);
  }

  /**
   * Send generic message via WhatsApp
   */
  async sendMessage(phoneNumber, message) {
    return await this.service.sendMessage(phoneNumber, message);
  }

  /**
   * Check service status
   */
  async checkStatus() {
    return await this.service.checkStatus();
  }
}

// Export singleton instance
module.exports = new WhatsAppProvider();
