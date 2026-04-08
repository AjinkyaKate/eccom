const GreenAPIService = require('./greenapi.service');
const MetaCloudService = require('./meta-cloud.service');
const MockWhatsAppService = require('./mock.service');

class WhatsAppProvider {
  constructor() {
    const provider =
      process.env.OTP_MOCK_MODE === 'true' ? 'mock' : process.env.WHATSAPP_PROVIDER || 'greenapi';

    switch (provider) {
      case 'mock':
        this.service = new MockWhatsAppService();
        this.providerName = 'mock';
        break;
      case 'meta':
        this.service = new MetaCloudService();
        this.providerName = 'meta';
        break;
      case 'greenapi':
      default:
        this.service = new GreenAPIService();
        this.providerName = 'greenapi';
        break;
    }
  }

  async sendOTP(phoneNumber, otp) {
    return this.service.sendOTP(phoneNumber, otp);
  }

  async sendMessage(phoneNumber, message) {
    return this.service.sendMessage(phoneNumber, message);
  }

  async sendFileByUrl(phoneNumber, fileUrl, fileName, caption) {
    return this.service.sendFileByUrl(phoneNumber, fileUrl, fileName, caption);
  }

  async sendImageByUrl(phoneNumber, imageUrl, caption) {
    if (typeof this.service.sendImageByUrl === 'function') {
      return this.service.sendImageByUrl(phoneNumber, imageUrl, caption);
    }

    return this.service.sendFileByUrl(phoneNumber, imageUrl, 'bill-preview.png', caption);
  }

  async sendTemplate(phoneNumber, templateName, payload = {}) {
    if (typeof this.service.sendTemplate !== 'function') {
      throw new Error(`Provider ${this.providerName} does not support template delivery`);
    }

    return this.service.sendTemplate(phoneNumber, templateName, payload);
  }

  supportsTemplateDelivery() {
    return typeof this.service.sendTemplate === 'function';
  }

  async checkStatus() {
    return this.service.checkStatus();
  }
}

module.exports = new WhatsAppProvider();
