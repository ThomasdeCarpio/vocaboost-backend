// src/models/VocabularyList.js

const supabase = require('../config/database');

class VocabularyList {

    /**
     * MODIFIED HELPER METHOD:
     * This method now validates that all provided tags exist in the database.
     * It no longer creates new tags.
     * @param {number} listId - The ID of the vocab list.
     * @param {string[]} tagNames - An array of tag names to link.
     */
    static async _handleTags(listId, tagNames) {
        // First, clear all existing tag associations for this list.
        // This makes the logic simpler: we always just set the new list of tags.
        await supabase.from('list_tags').delete().eq('list_id', listId);

        // If the user provides an empty array, we're done.
        if (!tagNames || tagNames.length === 0) {
            return;
        }

        // Step 1: Find which of the provided tags ACTUALLY exist in the 'tags' table.
        const { data: existingTags, error: findError } = await supabase
            .from('tags')
            .select('id, name')
            .in('name', tagNames); // .in() finds all rows where 'name' is in the provided array.

        if (findError) {
            console.error('Error finding tags:', findError);
            throw findError;
        }

        // Step 2: Security and Data Integrity Check.
        // If the number of found tags doesn't match the number provided by the user,
        // it means they tried to use a tag that doesn't exist.
        if (existingTags.length !== tagNames.length) {
            const existingNames = existingTags.map(t => t.name);
            const invalidTags = tagNames.filter(t => !existingNames.includes(t));
            
            // Throw a specific error that the controller can catch and show to the user.
            const error = new Error(`Invalid tag(s) provided: [${invalidTags.join(', ')}]. Please use existing tags.`);
            error.statusCode = 400; // Bad Request
            throw error;
        }

        // Step 3: Create the links in the 'list_tags' junction table.
        const listTagRecords = existingTags.map(tag => ({
            list_id: listId,
            tag_id: tag.id
        }));

        const { error: linkError } = await supabase.from('list_tags').insert(listTagRecords);

        if (linkError) {
            console.error('Error linking tags to list:', linkError);
            throw linkError;
        }
    }

    /**
     * CREATE: Creates a new vocabulary list.
     */
    static async create(listData) {
        const { title, description, privacy_setting, creator_id, tags = [] } = listData;

        const { data: newList, error: listError } = await supabase
            .from('vocab_lists')
            .insert({ title, description, privacy_setting, creator_id })
            .select()
            .single();

        if (listError) {
            console.error('Error creating vocab list:', listError);
            throw new Error(listError.message);
        }
        
        if (tags.length > 0) {
            // This now validates that the tags exist before linking.
            await this._handleTags(newList.id, tags);
        }

        return newList;
    }

    /**
     * READ (Single): Finds a single list by its ID.
     */
    static async findById(id) {
        const { data, error } = await supabase
            .from('vocab_lists')
            .select(`
                id, title, description, privacy_setting, created_at, creator_id,
                creator:profiles(display_name),
                words(id, term, definition),
                tags:list_tags(tag:tags(name))
            `)
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') {
             console.error('Error finding list by ID:', error);
             throw new Error(error.message);
        }

        if (data && data.tags) {
            data.tags = data.tags.map(t => t.tag.name);
        }
        
        return data;
    }

    /**
     * READ (Multiple): Finds all lists for a specific user.
     */
    static async findByCreator(creatorId, { page = 1, limit = 20 }) {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await supabase
            .from('vocab_lists')
            .select('*, words(count)', { count: 'exact' })
            .eq('creator_id', creatorId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            throw new Error(error.message);
        }
        return { 
            lists: data || [], 
            pagination: { total: count, page, limit } 
        };
    }

    /**
     * UPDATE: Updates a list's core properties.
     */
    static async update(id, updates) {
        const allowedUpdates = {};
        if (updates.title) allowedUpdates.title = updates.title;
        if (updates.description) allowedUpdates.description = updates.description;
        if (updates.privacy_setting) allowedUpdates.privacy_setting = updates.privacy_setting;

        if (Object.keys(allowedUpdates).length === 0) {
            return this.findById(id);
        }

        allowedUpdates.updated_at = new Date();

        const { data: updatedList, error } = await supabase
            .from('vocab_lists')
            .update(allowedUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(error.message);
        }
        
        return updatedList;
    }

    /**
     * DELETE: Deletes a list.
     */
    static async delete(id) {
        const { error } = await supabase.from('vocab_lists').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return true;
    }
    
    /**
     * ADD TAGS: Replaces all tags for a specific list.
     */
    static async setTagsForList(listId, tagNames) {
        await this._handleTags(listId, tagNames);
    }
}

module.exports = VocabularyList;