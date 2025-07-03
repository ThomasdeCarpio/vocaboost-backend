// src/app.js

const express = require('express');
const passport = require('passport');

// Import routes
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes'); // ✅ 1. RENAMED from userRoutes
const vocabularyRoutes = require('./routes/vocabularyRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const classroomRoutes = require('./routes/classroomRoutes');
const adminRoutes = require('./routes/adminRoutes');
const tagRoutes = require('./routes/tagRoutes');

// Import middleware
const { securityMiddleware } = require('./middleware/core/security');
const { requestLogger, auditLogger } = require('./middleware/core/logging');
const { parsingMiddleware } = require('./middleware/core/parsing');
const { sessionMiddleware } = require('./middleware/core/session');
const { requestId, requestContext } = require('./middleware/monitoring/requestId');
const { performanceMonitor } = require('./middleware/monitoring/performance');
const { errorHandler, notFoundHandler } = require('./middleware/monitoring/errorHandler');
const rateLimiters = require('./middleware/protection/rateLimiter');

// Import passport config
require('./config/auth');

// Create Express app
const app = express();

// Basic middleware - this order is correct and well-structured
app.use(requestId);
app.use(requestContext);
app.use(performanceMonitor);
app.use(...securityMiddleware());
app.use(requestLogger);
app.use(...parsingMiddleware());
app.use(sessionMiddleware);
app.use('/api/', rateLimiters.global);
app.use('/api/', auditLogger);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// API Routes - Mount all the different routers onto the main app
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes); // ✅ 2. RENAMED from /api/users to be more RESTful
app.use('/api/vocabulary', vocabularyRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tags', tagRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// 404 handler for any routes not matched above
app.use(notFoundHandler);

// Final global error handling middleware - must be last
app.use(errorHandler);

module.exports = app;