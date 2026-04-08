const axios = require('axios');

class GreenAPIService {
  constructor() {
    this.instanceId = process.env.GREEN_API_INSTANCE_ID;
    this.token = process.env.GREEN_API_TOKEN;
    this.baseUrl = `https://api.green-api.com/waInstance${this.instanceId}`;
  }

  /**
   * Send WhatsApp message
   * @param {string} phoneNumber - Phone number with country code (e.g., 919876543210)
   * @param {string} message - Message text
   */
  async sendMessage(phoneNumber, message) {
    try {
      // Remove + sign and any spaces from phone number
      const cleanPhone = phoneNumber.replace(/[\s+]/g, '');

      const url = `${this.baseUrl}/sendMessage/${this.token}`;

      const payload = {
        chatId: `${cleanPhone}@c.us`,
        message: message,
      };

      const response = await axios.post(url, payload);

      if (response.data.idMessage) {
        return {
          success: true,
          messageId: response.data.idMessage,
          message: 'WhatsApp message sent successfully',
        };
      }

      throw new Error('Failed to send message');
    } catch (error) {
      console.error('Green API Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Send file via URL (Image/Document)
   * @param {string} phoneNumber - Recipient
   * @param {string} url - Public URL of file
   * @param {string} fileName - Name for the file
   * @param {string} caption - Optional text caption
   */
  async sendFileByUrl(phoneNumber, fileUrl, fileName, caption = '') {
    try {
      const cleanPhone = phoneNumber.replace(/[\s+]/g, '');
      const url = `${this.baseUrl}/sendFileByUrl/${this.token}`;

      const payload = {
        chatId: `${cleanPhone}@c.us`,
        urlFile: fileUrl,
        fileName: fileName,
        caption: caption,
      };

      const response = await axios.post(url, payload);

      if (response.data.idMessage) {
        return {
          success: true,
          messageId: response.data.idMessage,
        };
      }
      throw new Error('Failed to send file');
    } catch (error) {
      console.error('Green API File Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async sendImageByUrl(phoneNumber, imageUrl, caption = '') {
    return this.sendFileByUrl(phoneNumber, imageUrl, 'bill-preview.png', caption);
  }

  /**
   * Send OTP via WhatsApp
   * @param {string} phoneNumber - Phone number with country code
   * @param {string} otp - OTP code
   */
  async sendOTP(phoneNumber, otp) {
    const message = `Your verification code is: *${otp}*\n\nThis code will expire in ${process.env.OTP_EXPIRY_MINUTES} minutes.\n\nDo not share this code with anyone.`;

    return await this.sendMessage(phoneNumber, message);
  }

  async sendTemplate(phoneNumber, templateName, payload = {}) {
    const templatePreview = [templateName, ...(payload.bodyParameters || [])].join(' | ');
    return this.sendMessage(phoneNumber, templatePreview);
  }

  /**
   * Check if instance is ready
   */
  async checkStatus() {
    try {
      const url = `${this.baseUrl}/getStateInstance/${this.token}`;
      const response = await axios.get(url);

      return {
        success: true,
        state: response.data.stateInstance,
      };
    } catch (error) {
      console.error('Green API Status Error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = GreenAPIService;
