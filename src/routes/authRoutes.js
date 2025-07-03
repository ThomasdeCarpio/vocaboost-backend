// src/routes/authRoutes.js

const router = require('express').Router();
const passport = require('passport');
const authController = require('../controllers/authController'); // This controller is already updated
const rateLimiters = require('../middleware/protection/rateLimiter');
const loginAttempts = require('../middleware/protection/loginAttempts');
// const { authValidators } = require('../middleware/validation/validators');

// [USC1] Register a new user
router.post('/register', 
  rateLimiters.auth,
  // authValidators.register,
  authController.register
);

// [USC2] Login with email/password
router.post('/login',
  rateLimiters.auth,
  // authValidators.login,
  loginAttempts.checkLoginAttempts(),
  authController.login
);

// [USC2] Google OAuth Authentication Flow
router.get('/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    authController.googleLogin
);

// [USC3] Logout
router.post('/logout', authController.logout);

// Password Reset Flow
router.post('/forgot-password',
  rateLimiters.email, // Use a stricter email-based rate limit
  authController.forgotPassword
);

// The actual password update happens on the frontend via Supabase client-side library
// after the user clicks the link from the forgot-password email.
// We don't need a `/reset-password` endpoint on the backend for this flow.

// Email Verification Flow
router.post('/resend-verification',
  rateLimiters.email,
  authController.resendVerificationEmail
);

// The user clicks the verification link from their email, which points to the FRONTEND.
// The frontend then uses the Supabase client library to verify the token.
// We do not need a `/verify-email` endpoint on the backend.

module.exports = router;