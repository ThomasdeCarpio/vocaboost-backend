// src/models/ProfileExtensions.js

const supabase = require('../config/database');

class ProfileExtensions {
    
    /**
     * Creates the initial teacher_info record when a user signs up as a teacher.
     * This should be called from the authController during registration.
     * @param {string} userId - The UUID of the new teacher.
     * @param {object} teacherData - Contains 'institution', 'credentials_url'.
     * @returns {Promise<object>} The created teachers_info record.
     */
    static async createTeacherInfo(userId, teacherData = {}) {
        const { institution, credentials_url } = teacherData;
        
        const { data, error } = await supabase
            .from('teachers_info')
            .insert({
                user_id: userId,
                institution,
                credentials_url,
                verification_status: 'pending' // Always starts as pending
            })
            .select()
            .single();
        
        // Ignore duplicate key error if this runs more than once by mistake
        if (error && error.code !== '23505') {
            console.error('Error creating teacher info:', error);
            throw error;
        }

        return data;
    }

    /**
     * Updates a teacher's verification status. (For Admin use)
     * @param {string} userId - The teacher's UUID.
     * @param {string} status - The new status ('approved' or 'rejected').
     * @param {string} [reason] - The reason for rejection.
     * @returns {Promise<object>} The updated teachers_info record.
     */
    static async updateTeacherVerification(userId, status, reason = null) {
        const { data, error } = await supabase
            .from('teachers_info')
            .update({
                verification_status: status,
                rejection_reason: reason
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            console.error('Error updating teacher verification:', error);
            throw error;
        }
        return data;
    }

    /**
     * Fetches all pending teacher requests for the admin panel.
     * @returns {Promise<Array<object>>}
     */
    static async getPendingTeacherRequests() {
        const { data, error } = await supabase
            .from('teachers_info')
            .select(`
                *,
                profile:profiles(display_name, id)
            `)
            .eq('verification_status', 'pending');
        
        if (error) throw error;
        return data || [];
    }
}

module.exports = ProfileExtensions;