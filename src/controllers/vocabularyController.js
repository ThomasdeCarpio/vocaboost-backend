// src/controllers/vocabularyController.js

// Import the Models. The controller's job is to call these.
const VocabularyList = require('../models/VocabularyList');
const Word = require('../models/Word');

class VocabularyController {

    // Handles POST /api/vocabulary/lists
    // Creates a new vocabulary list.
    async createList(req, res, next) {
        try {
            // 1. Extract data from the request body and the authenticated user.
            const listData = {
                ...req.body,
                creator_id: req.user.id // This comes from your 'authenticateJWT' middleware.
            };

            // 2. Call the Model to do the database work.
            const newList = await VocabularyList.create(listData);

            // 3. Send the successful response.
            res.status(201).json({ success: true, data: newList });
        } catch (error) {
            // 4. Pass any errors to the global error handler.
            next(error);
        }
    }

    // Handles GET /api/vocabulary/lists/:id
    // Fetches a single vocabulary list.
    async getListById(req, res, next) {
        try {
            const { id } = req.params;
            const list = await VocabularyList.findById(id);

            if (!list) {
                return res.status(404).json({ success: false, error: 'List not found' });
            }

            // --- IMPORTANT: Business Logic & Security Check ---
            // A controller must enforce permissions.
            if (list.privacy_setting === 'private' && list.creator_id !== req.user?.id) {
                // The optionalAuth middleware allows req.user to be null.
                return res.status(403).json({ success: false, error: 'You do not have permission to view this list' });
            }

            res.json({ success: true, data: list });
        } catch (error) {
            next(error);
        }
    }

    // Handles GET /api/vocabulary/lists/mine
    // Fetches all lists created by the currently logged-in user.
    async getMyLists(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const result = await VocabularyList.findByCreator(req.user.id, { page, limit });
            res.json({ success: true, ...result });
        } catch (error) {
            next(error);
        }
    }

    // Handles PUT /api/vocabulary/lists/:id
    // Updates a list's core properties (title, description, etc.).
    async updateList(req, res, next) {
        try {
            const { id } = req.params;

            // --- IMPORTANT: Security Check for Ownership ---
            const existingList = await VocabularyList.findById(id);
            if (!existingList) {
                return res.status(404).json({ success: false, error: 'List not found' });
            }
            if (existingList.creator_id !== req.user.id) {
                return res.status(403).json({ success: false, error: 'You do not have permission to edit this list' });
            }

            const updatedList = await VocabularyList.update(id, req.body);
            res.json({ success: true, data: updatedList, message: 'List updated successfully.' });
        } catch (error) {
            next(error);
        }
    }

    // Handles DELETE /api/vocabulary/lists/:id
    // Deletes a vocabulary list.
    async deleteList(req, res, next) {
        try {
            const { id } = req.params;

            // --- IMPORTANT: Security Check for Ownership ---
            const existingList = await VocabularyList.findById(id);
            if (!existingList) {
                return res.status(404).json({ success: false, error: 'List not found' });
            }
            if (existingList.creator_id !== req.user.id) {
                return res.status(403).json({ success: false, error: 'You do not have permission to delete this list' });
            }

            await VocabularyList.delete(id);
            res.status(200).json({ success: true, message: 'List deleted successfully.' });
        } catch (error) {
            next(error);
        }
    }

    // Handles POST /api/vocabulary/lists/:id/tags
    // Updates the tags for a specific list.
    async updateTagsForList(req, res, next) {
        try {
            const { id } = req.params;
            const { tags } = req.body; // Expects an array of tag names, e.g., ["learning", "new"]

            if (!Array.isArray(tags)) {
                return res.status(400).json({ success: false, error: 'Tags must be an array of strings.' });
            }

            // --- IMPORTANT: Security Check for Ownership ---
            const existingList = await VocabularyList.findById(id);
            if (!existingList) {
                return res.status(404).json({ success: false, error: 'List not found' });
            }
            if (existingList.creator_id !== req.user.id) {
                return res.status(403).json({ success: false, error: 'You do not have permission to edit this list' });
            }

            await VocabularyList.addTagsToList(id, tags);
            res.json({ success: true, message: 'Tags updated successfully.' });
        } catch (error) {
            next(error);
        }
    }
    
    // --- Word Management ---

    // Handles POST /api/vocabulary/lists/:listId/words
    // Adds a word to a specific list.
    async addWordToList(req, res, next) {
        try {
            const { listId } = req.params;

            // --- IMPORTANT: Security Check for Ownership ---
            const existingList = await VocabularyList.findById(listId);
            if (!existingList) {
                return res.status(404).json({ success: false, error: 'List not found' });
            }
            if (existingList.creator_id !== req.user.id) {
                return res.status(403).json({ success: false, error: 'You do not have permission to add words to this list' });
            }

            const wordData = { ...req.body, list_id: listId };
            const newWord = await Word.create(wordData);
            res.status(201).json({ success: true, data: newWord });
        } catch (error) {
            next(error);
        }
    }

    // Handles DELETE /api/vocabulary/words/:wordId
    // Deletes a specific word.
    async deleteWord(req, res, next) {
        try {
            const { wordId } = req.params;

            // --- IMPORTANT: Nested Security Check ---
            // We must ensure the user owns the LIST that the word belongs to.
            const word = await Word.findById(wordId);
            if (!word) {
                return res.status(404).json({ success: false, error: 'Word not found' });
            }

            const list = await VocabularyList.findById(word.list_id);
            if (!list || list.creator_id !== req.user.id) {
                return res.status(403).json({ success: false, error: 'You do not have permission to delete this word' });
            }

            await Word.delete(wordId);
            res.status(200).json({ success: true, message: 'Word deleted successfully.' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new VocabularyController();