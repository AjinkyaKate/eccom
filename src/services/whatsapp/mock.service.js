class MockWhatsAppService {
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

  async sendOTP(phoneNumber, otp) {
    const result = await this.sendMessage(
      phoneNumber,
      `Your verification code is: ${otp} (mock delivery for local testing)`
    );

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
