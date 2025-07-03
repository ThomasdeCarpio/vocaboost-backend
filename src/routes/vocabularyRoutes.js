// src/routes/vocabularyRoutes.js

const router = require('express').Router();
const vocabularyController = require('../controllers/vocabularyController');
const { authenticateJWT, optionalAuth } = require('../middleware/auth');
// You can uncomment and add validation middleware as you build it.
// const { vocabularyValidators } = require('../middleware/validation/validators');

// =================================================================
// VOCABULARY LIST ROUTES
// =================================================================

// READ: Get a single list by its ID. (Auth is optional for public lists)
router.get('/lists/:id', optionalAuth, vocabularyController.getListById);

// Apply authentication middleware for all routes below this point.
// All subsequent actions require a user to be logged in.
router.use(authenticateJWT);

// CREATE: Create a new vocabulary list.
router.post('/lists', /* vocabularyValidators.createList, */ vocabularyController.createList);

// READ: Get all lists created by the currently logged-in user.
router.get('/lists', vocabularyController.getMyLists);

// UPDATE: Update a list's core properties (title, description, etc.).
router.put('/lists/:id', /* vocabularyValidators.updateList, */ vocabularyController.updateList);

// DELETE: Delete an entire vocabulary list.
router.delete('/lists/:id', vocabularyController.deleteList);

// =================================================================
// TAG MANAGEMENT ROUTES (for a specific list)
// =================================================================

// UPDATE TAGS: Set/replace all tags for a specific list.
// The request body should be like: { "tags": ["learning", "new", "ielts"] }
router.put('/lists/:id/tags', vocabularyController.updateTagsForList);


// =================================================================
// WORD MANAGEMENT ROUTES
// =================================================================

// CREATE WORD: Add a new word to a specific list.
// This is nested under a list because a word cannot exist without a list.
router.post('/lists/:listId/words', /* vocabularyValidators.addWord, */ vocabularyController.addWordToList);

// DELETE WORD: Delete a single word by its own ID.
// This route is not nested because you can identify a word by its unique ID.
router.delete('/words/:wordId', vocabularyController.deleteWord);

// You can add routes for updating a word here as well.
// router.put('/words/:wordId', vocabularyController.updateWord);


module.exports = router;