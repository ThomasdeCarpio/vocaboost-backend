// src/routes/tagRoutes.js

const router = require('express').Router();
const tagController = require('../controllers/tagController');
const { authenticateJWT, requireRole } = require('../middleware/auth');
// You can add validation middleware from express-validator here as well
// const { body } = require('express-validator');

// --- PUBLIC ROUTE ---
// Any user (even unauthenticated) can fetch the list of available tags.
// This is useful for a tag cloud or a dropdown in the UI.
router.get('/', tagController.getAllTags);

// --- ADMIN-ONLY ROUTE ---
// Only an admin can create a new tag in the system.
// The `requireRole('admin')` middleware enforces this.
router.post(
    '/',
    authenticateJWT,      // First, ensure the user is logged in.
    requireRole('admin'), // Then, ensure the user has the 'admin' role.
    tagController.createTag
);

// You can add routes for updating/deleting tags here later, also protected by admin role.
// router.put('/:id', authenticateJWT, requireRole('admin'), tagController.updateTag);
// router.delete('/:id', authenticateJWT, requireRole('admin'), tagController.deleteTag);

module.exports = router;