class MockWhatsAppService {
  async sendTemplate(phoneNumber, templateName, payload = {}) {
    const messageId = `mock-template-${Date.now()}`;
    console.log(
      `[Mock WhatsApp Template] ${phoneNumber}: ${templateName} ${JSON.stringify(payload.bodyParameters || [])}`
    );

    return {
      success: true,
      mock: true,
      messageId,
      templateName,
      message: 'Mock WhatsApp template generated for local testing',
    };
  }

  async sendMessage(phoneNumber, message) {
    const messageId = `mock-msg-${Date.now()}`;

    console.log(`[Mock WhatsApp] ${phoneNumber}: ${message}`);

    return {
      success: true,
      mock: true,
      messageId,
      message: 'Mock WhatsApp message generated for local testing',
    };
  }

  async sendFileByUrl(phoneNumber, fileUrl, fileName, caption) {
    const messageId = `mock-file-${Date.now()}`;

    console.log(`[Mock WhatsApp File] ${phoneNumber}: [${fileName}](${fileUrl}) - ${caption}`);

    return {
      success: true,
      mock: true,
      messageId,
      message: 'Mock WhatsApp file message generated for local testing',
    };
  }

  async sendOTP(phoneNumber, otp) {
    const result = await this.sendTemplate(phoneNumber, 'auth_otp_login', {
      bodyParameters: [otp, process.env.OTP_EXPIRY_MINUTES || '5'],
    });

    return {
      ...result,
      debugOtp: otp,
      message: 'Mock OTP generated for local testing',
    };
  }

  async checkStatus() {
    return {
      success: true,
      mock: true,
      state: 'mock-ready',
    };
  }
}

module.exports = MockWhatsAppService;
