// src/models/Word.js

const supabase = require('../config/database');

class Word {

    /**
     * CREATE: Adds a new word to a specific list.
     * @param {object} wordData - Contains list_id, term, definition, etc.
     * @returns {Promise<object>} The newly created word object.
     */
    static async create(wordData) {
        const { list_id, term, definition, phonetics, example_sentence, image_url, audio_url } = wordData;
        const { data, error } = await supabase
            .from('words')
            .insert({ list_id, term, definition, phonetics, example_sentence, image_url, audio_url })
            .select()
            .single();

        if (error) {
            console.error('Error creating word:', error);
            throw new Error(error.message);
        }
        return data;
    }

    /**
     * READ: Finds a single word by its ID.
     * @param {number} id - The ID of the word.
     * @returns {Promise<object|null>} The word object or null if not found.
     */
    static async findById(id) {
        const { data, error } = await supabase
            .from('words')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error finding word by ID:', error);
            throw new Error(error.message);
        }
        return data;
    }

    /**
     * UPDATE: Modifies an existing word.
     * @param {number} id - The ID of the word to update.
     * @param {object} updates - An object with the fields to update.
     * @returns {Promise<object>} The updated word object.
     */
    static async update(id, updates) {
        const { data, error } = await supabase
            .from('words')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
            
        if (error) {
            console.error('Error updating word:', error);
            throw new Error(error.message);
        }
        return data;
    }

    /**
     * DELETE: Removes a word from the database.
     * @param {number} id - The ID of the word to delete.
     * @returns {Promise<boolean>} True on success.
     */
    static async delete(id) {
        const { error } = await supabase
            .from('words')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting word:', error);
            throw new Error(error.message);
        }
        return true;
    }

    /**
     * Adds synonyms to a word.
     * This method handles adding multiple synonyms at once.
     * @param {number} wordId - The ID of the word.
     * @param {string[]} synonyms - An array of synonym strings.
     * @returns {Promise<Array<object>>} The created synonym records.
     */
    static async addSynonyms(wordId, synonyms) {
        if (!synonyms || synonyms.length === 0) return [];
        
        const synonymRecords = synonyms.map(s => ({ word_id: wordId, synonym: s }));
        
        const { data, error } = await supabase
            .from('word_synonyms')
            .insert(synonymRecords, { onConflict: 'word_id, synonym' }) // Ignore duplicates
            .select();

        if (error) {
            console.error('Error adding synonyms:', error);
            throw new Error(error.message);
        }
        return data;
    }
}

module.exports = Word;