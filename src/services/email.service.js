const isMockModeEnabled = () =>
  process.env.NODE_ENV !== 'production' &&
  (process.env.EMAIL_MOCK_MODE === 'true' || !process.env.SMTP_HOST);

const createTransporter = () => {
  const nodemailer = require('nodemailer');

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });
};

const sendOTP = async (email, otp) => {
  if (isMockModeEnabled()) {
    console.log(`[Mock Email OTP] ${email}: ${otp}`);
    return {
      success: true,
      mock: true,
      debugOtp: otp,
      message: 'Mock email OTP generated for local testing',
    };
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Your login OTP',
      text: `Your login code is ${otp}. It expires in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin-bottom: 12px;">Your login OTP</h2>
          <p>Use this code to continue:</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${otp}</p>
          <p>This code expires in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });

    return {
      success: true,
      mock: false,
      message: 'OTP sent successfully to email',
    };
  } catch (error) {
    console.error('Email OTP Error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  sendOTP,
};
