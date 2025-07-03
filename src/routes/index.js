// src/routes/index.js

const router = require('express').Router();

// Import all the individual route modules
const authRoutes = require('./authRoutes');
const profileRoutes = require('./profileRoutes'); // ✅ RENAMED from userRoutes
const vocabularyRoutes = require('./vocabularyRoutes');
const tagRoutes = require('./tagRoutes');
const reviewRoutes = require('./reviewRoutes');
const classroomRoutes = require('./classroomRoutes');
const adminRoutes = require('./adminRoutes');

// Mount each router onto its base path
router.use('/auth', authRoutes);
router.use('/profiles', profileRoutes); // ✅ RENAMED from /users to be more RESTful
router.use('/vocabulary', vocabularyRoutes);
router.use('/tags', tagRoutes);
router.use('/review', reviewRoutes);
router.use('/classrooms', classroomRoutes);
router.use('/admin', adminRoutes);

// General health check endpoint for the entire API
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

module.exports = router;