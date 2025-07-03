// src/routes/profileRoutes.js

const router = require('express').Router();
const profileController = require('../controllers/profileController'); // ✅ Use the new Profile controller
const { authenticateJWT } = require('../middleware/auth');
// Import any necessary validators
// const { body } = require('express-validator');
// const { handleValidationErrors } = require('../middleware/validation/validators');

// All routes in this file are for an authenticated user acting on their own profile.
// Therefore, we apply the authentication middleware to all of them at once.
router.use(authenticateJWT);

// --- Profile Management ---

// [USC12] Get the current user's own profile
router.get('/me', profileController.getMyProfile);

// [USC12] Update the current user's own profile
router.put('/me', profileController.updateMyProfile);


// --- Account Security ---

// Change password for the logged-in user
// Note: This route was moved from authRoutes because it's an action performed
// by an already authenticated user, not part of the initial login flow.
router.post('/change-password', profileController.changeMyPassword);

// Request account deletion for the logged-in user
router.post('/request-deletion', profileController.requestAccountDeletion);


// --- Notifications ---

// Get notifications for the logged-in user
router.get('/notifications', profileController.getMyNotifications);

// Mark notifications as read for the logged-in user
router.post('/notifications/mark-read', profileController.markNotificationsAsRead);


// --- Content Reporting ---

// [USC22] Allows the logged-in user to report content
router.post('/report', profileController.reportContent);

module.exports = router;