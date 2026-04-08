const axios = require('axios');

class MetaCloudService {
  constructor() {
    this.accessToken = process.env.META_ACCESS_TOKEN;
    this.phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    this.graphApiVersion = process.env.META_GRAPH_API_VERSION || 'v23.0';
    this.baseUrl = `https://graph.facebook.com/${this.graphApiVersion}/${this.phoneNumberId}`;
    this.defaultLanguageCode = process.env.META_TEMPLATE_LANGUAGE || 'en_US';
  }

  ensureConfigured() {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('Meta WhatsApp Cloud API is not configured. Set META_ACCESS_TOKEN and META_PHONE_NUMBER_ID.');
    }
  }

  formatPhoneNumber(phoneNumber) {
    return String(phoneNumber || '').replace(/[^\d]/g, '');
  }

  buildBodyParameters(bodyParameters = []) {
    return bodyParameters
      .filter((value) => value !== undefined && value !== null)
      .map((value) => ({
        type: 'text',
        text: String(value),
      }));
  }

  async postMessage(payload) {
    this.ensureConfigured();

    const response = await axios.post(`${this.baseUrl}/messages`, payload, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      messageId: response.data?.messages?.[0]?.id,
      contactWaId: response.data?.contacts?.[0]?.wa_id,
      raw: response.data,
    };
  }

  async sendTemplate(phoneNumber, templateName, payload = {}) {
    try {
      const cleanPhone = this.formatPhoneNumber(phoneNumber);
      const bodyParameters = this.buildBodyParameters(payload.bodyParameters || []);
      const requestPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: payload.languageCode || this.defaultLanguageCode,
          },
        },
      };

      if (bodyParameters.length > 0) {
        requestPayload.template.components = [
          {
            type: 'body',
            parameters: bodyParameters,
          },
        ];
      }

      return await this.postMessage(requestPayload);
    } catch (error) {
      console.error('Meta Cloud API Template Error:', error.response?.data || error.message);
      return {
        success: false,
        error:
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          error.message,
      };
    }
  }

  async sendMessage(phoneNumber, message) {
    try {
      const cleanPhone = this.formatPhoneNumber(phoneNumber);
      return await this.postMessage({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: String(message),
        },
      });
    } catch (error) {
      console.error('Meta Cloud API Message Error:', error.response?.data || error.message);
      return {
        success: false,
        error:
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          error.message,
      };
    }
  }

  async sendFileByUrl(phoneNumber, fileUrl, fileName, caption = '') {
    try {
      const cleanPhone = this.formatPhoneNumber(phoneNumber);
      return await this.postMessage({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'document',
        document: {
          link: fileUrl,
          caption: String(caption || ''),
          filename: String(fileName || 'attachment'),
        },
      });
    } catch (error) {
      console.error('Meta Cloud API File Error:', error.response?.data || error.message);
      return {
        success: false,
        error:
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          error.message,
      };
    }
  }

  async sendImageByUrl(phoneNumber, imageUrl, caption = '') {
    try {
      const cleanPhone = this.formatPhoneNumber(phoneNumber);
      return await this.postMessage({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'image',
        image: {
          link: imageUrl,
          caption: String(caption || ''),
        },
      });
    } catch (error) {
      console.error('Meta Cloud API Image Error:', error.response?.data || error.message);
      return {
        success: false,
        error:
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          error.message,
      };
    }
  }

  async sendOTP(phoneNumber, otp) {
    const templateName = process.env.META_TEMPLATE_OTP || 'auth_otp_login';
    const expiryMinutes = process.env.OTP_EXPIRY_MINUTES || '5';

    return this.sendTemplate(phoneNumber, templateName, {
      bodyParameters: [otp, expiryMinutes],
    });
  }

  async checkStatus() {
    try {
      this.ensureConfigured();
      return {
        success: true,
        state: 'configured',
        provider: 'meta',
        phoneNumberId: this.phoneNumberId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = MetaCloudService;
