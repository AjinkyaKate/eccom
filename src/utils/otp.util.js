/**
 * Generate a random 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Calculate OTP expiry time
 * @param {number} minutes - Expiry time in minutes
 */
const getOTPExpiry = (minutes = null) => {
  const expiryMinutes = minutes || parseInt(process.env.OTP_EXPIRY_MINUTES) || 5;
  return new Date(Date.now() + expiryMinutes * 60 * 1000);
};

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 */
const validatePhoneNumber = (phone) => {
  // Basic validation for international phone numbers
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
};

/**
 * Format phone number (remove spaces, dashes)
 * @param {string} phone - Phone number to format
 */
const formatPhoneNumber = (phone) => {
  return phone.replace(/[\s-]/g, '');
};

module.exports = {
  generateOTP,
  getOTPExpiry,
  validatePhoneNumber,
  formatPhoneNumber,
};
