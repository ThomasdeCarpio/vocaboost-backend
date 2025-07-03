// src/models/Token.js

const supabase = require('../config/database');

class Token {

    /**
     * Creates a new token in the database.
     * @param {string} userId - The user's UUID.
     * @param {string} token - The unique token string.
     * @param {string} type - The type of token ('password_reset' or 'email_verification').
     * @param {Date} expiresAt - The expiration timestamp for the token.
     * @returns {Promise<object>} The created token record.
     */
    static async create(userId, token, type, expiresAt) {
        const { data, error } = await supabase
            .from('tokens')
            .insert({
                user_id: userId,
                token: token,
                type: type,
                expires_at: expiresAt
            })
            .select()
            .single();

        if (error) {
            console.error(`Error creating token of type ${type}:`, error);
            throw error;
        }
        return data;
    }

    /**
     * Finds a valid, unexpired, and unused token.
     * @param {string} token - The token string to find.
     * @param {string} type - The expected type of the token.
     * @returns {Promise<object|null>} The token record, including the user's profile, or null.
     */
    static async findValidToken(token, type) {
        const { data, error } = await supabase
            .from('tokens')
            .select(`
                *,
                profile:profiles(*)
            `)
            .eq('token', token)
            .eq('type', type)
            .is('used_at', null) // Check that used_at is NULL
            .gte('expires_at', new Date().toISOString()) // Check that it has not expired
            .single();

        // Ignore 'PGRST116' (No rows found), but throw other errors
        if (error && error.code !== 'PGRST116') {
            console.error(`Error finding token of type ${type}:`, error);
            throw error;
        }
        
        return data;
    }

    /**
     * Marks a token as used by setting the 'used_at' timestamp.
     * @param {string} token - The token string to invalidate.
     * @returns {Promise<boolean>} True on success.
     */
    static async markAsUsed(token) {
        const { error } = await supabase
            .from('tokens')
            .update({ used_at: new Date() })
            .eq('token', token);

        if (error) {
            console.error('Error marking token as used:', error);
            throw error;
        }
        return true;
    }
}

module.exports = Token;