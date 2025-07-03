// src/middleware/protection/loginAttempts.js

const cacheService = require('../../services/cacheService');
const EmailService = require('../../services/emailService');
const Profile = require('../../models/Profile'); // ✅ CHANGED: Import Profile model instead of User

class LoginAttemptsMiddleware {
  constructor() {
    this.maxAttempts = 5;
    this.lockoutDuration = 15 * 60; // 15 minutes in seconds
    this.attemptWindow = 15 * 60; // 15 minutes window for attempts
  }

  // Track failed login attempts
  async trackFailedAttempt(email, ipAddress) {
    const key = `login_attempts:${email}`;
    const ipKey = `login_attempts_ip:${ipAddress}`;
    
    try {
      const attempts = await cacheService.incr(key, this.attemptWindow);
      const ipAttempts = await cacheService.incr(ipKey, this.attemptWindow);
      
      if (attempts >= this.maxAttempts) {
        await this.lockAccount(email, attempts, ipAddress);
      }
      
      return {
        attempts,
        ipAttempts,
        remainingAttempts: Math.max(0, this.maxAttempts - attempts),
        isLocked: attempts >= this.maxAttempts
      };
    } catch (error) {
      console.error('Failed to track login attempt:', error);
      return {
        attempts: 0,
        ipAttempts: 0,
        remainingAttempts: this.maxAttempts,
        isLocked: false
      };
    }
  }

  // Clear attempts on successful login
  async clearAttempts(email, ipAddress) {
    try {
      await cacheService.del(`login_attempts:${email}`);
      await cacheService.del(`login_attempts_ip:${ipAddress}`);
      await cacheService.del(`account_locked:${email}`);
    } catch (error) {
      console.error('Failed to clear login attempts:', error);
    }
  }

  // Check if account is locked
  async isAccountLocked(email) {
    try {
      const lockKey = `account_locked:${email}`;
      const lockData = await cacheService.get(lockKey);
      
      if (lockData) {
        const remainingTime = Math.ceil(
          (lockData.lockedUntil - Date.now()) / 1000 / 60
        );
        
        return {
          isLocked: true,
          reason: lockData.reason,
          lockedUntil: lockData.lockedUntil,
          remainingMinutes: remainingTime > 0 ? remainingTime : 1
        };
      }
      
      return { isLocked: false };
    } catch (error) {
      console.error('Failed to check account lock:', error);
      return { isLocked: false };
    }
  }

  // Lock account after too many attempts
  async lockAccount(email, attempts, ipAddress) {
    try {
      const lockKey = `account_locked:${email}`;
      const lockedUntil = Date.now() + (this.lockoutDuration * 1000);
      
      const lockData = {
        email,
        attempts,
        ipAddress,
        lockedAt: Date.now(),
        lockedUntil,
        reason: `${attempts} failed login attempts`
      };
      
      await cacheService.set(lockKey, lockData, this.lockoutDuration);
      
      // Send notification email
      try {
        // ✅ CHANGED: Use the new Profile model to find the user's profile
        const profile = await Profile.findByEmail(email);
        if (profile) {
          const emailService = new EmailService();
          await emailService.sendAccountLockedNotification({ // Assumes this method exists in your email service
            to: email,
            fullName: profile.display_name || 'User',
            lockReason: lockData.reason,
            unlockTime: new Date(lockedUntil)
          });
        }
      } catch (emailError) {
        console.error('Failed to send lock notification:', emailError);
      }
      
      console.warn(`Account locked: ${email} after ${attempts} attempts from IP: ${ipAddress}`);
      
    } catch (error) {
      console.error('Failed to lock account:', error);
    }
  }

  // Middleware to check login attempts before processing
  checkLoginAttempts() {
    return async (req, res, next) => {
      const { email } = req.body;
      const ipAddress = req.ip;
      
      if (!email) {
        return next();
      }
      
      try {
        const lockStatus = await this.isAccountLocked(email);
        
        if (lockStatus.isLocked) {
          return res.status(429).json({
            success: false,
            error: 'Tài khoản tạm thời bị khóa do nhiều lần đăng nhập thất bại',
            details: {
              reason: lockStatus.reason,
              remainingMinutes: lockStatus.remainingMinutes,
              message: `Vui lòng thử lại sau ${lockStatus.remainingMinutes} phút.`
            }
          });
        }
        
        // IP-based rate limiting is still useful here
        const ipKey = `login_attempts_ip:${ipAddress}`;
        const ipAttempts = await cacheService.get(ipKey) || 0;
        
        if (ipAttempts >= this.maxAttempts * 2) {
          return res.status(429).json({
            success: false,
            error: 'Quá nhiều yêu cầu từ địa chỉ IP này.',
            details: {
              message: 'Vui lòng thử lại sau 15 phút.'
            }
          });
        }
        
        // Attach tracking functions to request so the controller can use them
        req.loginTracking = {
          trackFailure: () => this.trackFailedAttempt(email, ipAddress),
          clearAttempts: () => this.clearAttempts(email, ipAddress)
        };
        
        next();
      } catch (error) {
        console.error('Login attempts middleware error:', error);
        next(); // Don't block login if the middleware itself fails
      }
    };
  }

  // ... getAttemptStatus method remains the same ...
  async getAttemptStatus(email) {
    // This method does not need changes as it only interacts with the cache
    try {
      const key = `login_attempts:${email}`;
      const attempts = await cacheService.get(key) || 0;
      const lockStatus = await this.isAccountLocked(email);
      
      return {
        attempts: parseInt(attempts),
        maxAttempts: this.maxAttempts,
        remainingAttempts: Math.max(0, this.maxAttempts - attempts),
        isLocked: lockStatus.isLocked,
        lockDetails: lockStatus.isLocked ? lockStatus : null
      };
    } catch (error) {
      console.error('Failed to get attempt status:', error);
      return {
        attempts: 0,
        maxAttempts: this.maxAttempts,
        remainingAttempts: this.maxAttempts,
        isLocked: false
      };
    }
  }
}

module.exports = new LoginAttemptsMiddleware();