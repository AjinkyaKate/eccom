const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number with country code'],
    },
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ['customer', 'admin'],
      default: 'customer',
    },
    password: {
      type: String,
      select: false, // Don't return password by default
    },
    addresses: [
      {
        type: {
          type: String,
          enum: ['home', 'office', 'other'],
          default: 'home',
        },
        name: String,
        phone: String,
        street: {
          type: String,
          required: true,
        },
        city: {
          type: String,
          required: true,
        },
        state: {
          type: String,
          required: true,
        },
        pincode: {
          type: String,
          required: true,
        },
        landmark: String,
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],
    otp: {
      code: String,
      expiresAt: Date,
      attempts: {
        type: Number,
        default: 0,
      },
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userSchema.index({ role: 1 });

// Hash password before saving (only if password is modified)
userSchema.pre('save', async function () {
  // Clean up expired OTP
  if (this.otp && this.otp.expiresAt && this.otp.expiresAt < new Date()) {
    this.otp = undefined;
  }

  // Hash password if modified
  if (this.password && this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// Method to check if OTP is valid
userSchema.methods.isOTPValid = function (enteredOTP) {
  if (!this.otp || !this.otp.code || !this.otp.expiresAt) {
    return false;
  }

  if (this.otp.expiresAt < new Date()) {
    return false;
  }

  return this.otp.code === enteredOTP;
};

// Method to check if max attempts exceeded
userSchema.methods.isMaxAttemptsExceeded = function () {
  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS) || 3;
  return this.otp && this.otp.attempts >= maxAttempts;
};

// Method to compare password (for admin login)
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
