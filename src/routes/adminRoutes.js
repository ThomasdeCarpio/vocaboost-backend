// src/routes/adminRoutes.js

const router = require('express').Router();
const adminController = require('../controllers/adminController'); // This controller is already updated
const { authenticateJWT, requireRole } = require('../middleware/auth');
const rateLimiters = require('../middleware/protection/rateLimiter');

// Apply authentication and admin role middleware to all routes in this file
router.use(authenticateJWT, requireRole('admin'), rateLimiters.admin);

// --- User Management ---
// [USC18] Ban/Unban accounts
router.post('/profiles/ban', adminController.banAccount);
router.post('/profiles/unban', adminController.unbanAccount);
router.get('/profiles', adminController.listUsers); // List all user profiles
router.put('/profiles/:userId', adminController.updateUserByAdmin); // Update a user's role/status

// --- Teacher Verification ---
// [USC19] Approve Teacher Requests
router.get('/teacher-requests', adminController.getTeacherRequests);
router.post('/teacher-requests/:teacherId/review', adminController.reviewTeacherRequest);

// --- Content Moderation ---
// [USC20] Moderate Content
router.get('/reports', adminController.getReportedContent);
router.post('/reports/:reportId/moderate', adminController.moderateContent);

// --- System Analytics & Health ---
// [USC21] View system analytics
router.get('/analytics', adminController.getSystemAnalytics);
router.get('/health', (req, res) => res.json({ status: 'OK' })); // A simple health check for the admin scope

// ... other admin routes for logs, content, etc. ...

module.exports = router;