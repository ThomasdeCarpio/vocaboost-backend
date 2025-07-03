// src/models/Tag.js

const supabase = require('../config/database');

class Tag {
    /**
     * CREATE: Creates a new tag. (Primarily for Admins)
     * @param {string} name - The name of the new tag.
     * @returns {Promise<object>} The newly created tag object.
     */
    static async create(name) {
        const { data, error } = await supabase
            .from('tags')
            .insert({ name: name.toLowerCase().trim() }) // Standardize tags to lowercase
            .select()
            .single();

        if (error) {
            console.error('Error creating tag:', error);
            throw error; // Let the controller handle specific error codes (like unique violation)
        }
        return data;
    }

    /**
     * READ: Fetches all available tags from the database.
     * @returns {Promise<Array<object>>} An array of all tag objects.
     */
    static async getAll() {
        const { data, error } = await supabase
            .from('tags')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching all tags:', error);
            throw new Error(error.message);
        }
        return data || [];
    }

    // You could add update() and delete() methods here for admin use later.
}

module.exports = Tag;