// src/models/Profile.js

const supabase = require('../config/database');
const bcrypt = require('bcryptjs'); // Still needed if you handle password changes here

class Profile {
    
    /**
     * Finds a user's profile by their UUID.
     * @param {string} id - The user's UUID from auth.users.
     * @returns {Promise<object|null>} The profile object or null.
     */
    static async findById(id) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error; // Ignore 'PGRST116' (No rows found)
        return data;
    }
    
    /**
     * Finds a user's profile by their email address.
     * This requires a JOIN with the auth.users table.
     * NOTE: This is less efficient than findById. Use when ID is not available.
     * A database function/view could optimize this.
     * @param {string} email - The user's email.
     * @returns {Promise<object|null>} The profile object or null.
     */
    static async findByEmail(email) {
        // Since we can't directly query auth.users and join, we first get the user from auth
        // This should primarily be used in the auth flow. For internal logic, always use ID.
        const { data: { user }, error: authError } = await supabase.auth.admin.getUserByEmail(email);

        if (authError || !user) {
            return null; // User doesn't exist in auth, so no profile exists
        }
        
        // Now fetch the profile using the found ID
        return this.findById(user.id);
    }
    
    /**
     * Creates a new profile record. This is typically called right after
     * a new user is created in Supabase Auth.
     * @param {object} profileData - Must include 'id', can include 'display_name', 'role'.
     * @returns {Promise<object>} The newly created profile.
     */
    static async create(profileData) {
        // Set default status based on role
        if (profileData.role === 'teacher' && !profileData.account_status) {
            profileData.account_status = 'pending_verification';
        } else if (!profileData.account_status) {
            profileData.account_status = 'pending_verification'; // All new accounts need email verification
        }

        const { data, error } = await supabase
            .from('profiles')
            .insert(profileData)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    /**
     * Updates a profile record.
     * @param {string} id - The UUID of the profile to update.
     * @param {object} updates - An object with the fields to update.
     * @returns {Promise<object>} The updated profile object.
     */
    static async update(id, updates) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    /**
     * Fetches a full user profile including related data like teacher info.
     * @param {string} id - The user's UUID.
     * @returns {Promise<object>} A comprehensive profile object.
     */
    static async getFullProfile(id) {
        const { data, error } = await supabase
            .from('profiles')
            .select(`
                id,
                display_name,
                role,
                account_status,
                last_seen_at,
                teachers_info(*) 
            `)
            .eq('id', id)
            .single();
            
        if (error) throw error;
        
        // The result for teachers_info will be an array, but it's a 1-to-1 relationship.
        // Let's flatten it for easier use in the controller.
        if (data && data.teachers_info) {
            data.teacher_info = data.teachers_info[0] || null;
            delete data.teachers_info;
        }

        return data;
    }
}

module.exports = Profile;