// src/controllers/tagController.js

const Tag = require('../models/Tag');

class TagController {

    /**
     * Handles POST /api/tags
     * Allows an admin to create a new tag.
     */
    async createTag(req, res, next) {
        try {
            const { name } = req.body;
            if (!name || typeof name !== 'string' || name.trim() === '') {
                return res.status(400).json({ success: false, error: 'Tag name is required and must be a non-empty string.' });
            }

            const newTag = await Tag.create(name);
            res.status(201).json({ success: true, data: newTag });
        } catch (error) {
            // Handle the unique constraint violation error gracefully.
            if (error.code === '23505') { 
                return res.status(409).json({ success: false, error: 'A tag with this name already exists.' });
            }
            next(error); // Pass other errors to the global handler.
        }
    }

    /**
     * Handles GET /api/tags
     * Allows any user to get the list of available tags for their UI.
     */
    async getAllTags(req, res, next) {
        try {
            const tags = await Tag.getAll();
            res.json({ success: true, data: tags });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new TagController();