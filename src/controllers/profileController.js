// src/controllers/profileController.js

const supabase = require('../config/database');
const Profile = require('../models/Profile');
// Note: We might need other models like Report, Notification etc. here in the future.

class ProfileController {
    
    /**
     * [USC12] Get the profile of the currently logged-in user.
     * The user object is attached to `req.user` by the `authenticateJWT` middleware.
     */
    async getMyProfile(req, res, next) {
        try {
            // The `req.user` from the JWT middleware already contains the basic profile.
            // For more detailed info (like teacher info), we can call the model.
            const fullProfile = await Profile.getFullProfile(req.user.id);
            
            if (!fullProfile) {
                return res.status(404).json({ success: false, error: 'Profile not found' });
            }

            res.json({ success: true, data: fullProfile });
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * [USC12] Update the profile of the currently logged-in user.
     */
    async updateMyProfile(req, res, next) {
        try {
            const userId = req.user.id;
            const { display_name } = req.body;
            
            // The model layer handles updating the profile table.
            const updatedProfile = await Profile.update(userId, { display_name });

            // For avatar changes, you'd typically handle file uploads separately
            // and then just update the URL in the profile.
            
            res.json({
                success: true,
                data: updatedProfile,
                message: 'Profile updated successfully.'
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * Allows a logged-in user to change their own password.
     */
    async changeMyPassword(req, res, next) {
        try {
            const { newPassword } = req.body;
            // The user's identity is verified by the JWT, so we can securely update their password.
            
            const { error } = await supabase.auth.updateUser({
              password: newPassword
            });
            
            if (error) {
                // Supabase might return specific errors, e.g., about password strength
                return res.status(400).json({ success: false, error: error.message });
            }
            
            res.json({
                success: true,
                message: 'Password changed successfully.'
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * [USC22] Allows a user to report content.
     * We would need a Report model for this.
     */
    async reportContent(req, res, next) {
        try {
            const reporterId = req.user.id;
            const { contentType, contentId, reason } = req.body;
            
            // This logic would be moved to a 'Report.js' model.
            const { data: report, error } = await supabase
                .from('reports')
                .insert({
                    reporter_id: reporterId,
                    content_type: contentType,
                    content_id: contentId,
                    reason,
                    status: 'open'
                })
                .select()
                .single();

            if (error) throw error;
            
            res.status(201).json({
                success: true,
                data: report,
                message: 'Your report has been submitted successfully. Thank you for helping keep our community safe.'
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * Allows a user to request deletion of their own account.
     * This is a sensitive operation and should be handled with care.
     */
    async requestAccountDeletion(req, res, next) {
        try {
            const userId = req.user.id;

            // This action should be performed by an admin function for security,
            // as deleting a user can have cascading effects.
            // The controller's job is to kick off the process.
            
            // For now, we can simply update the user's status to 'suspended'
            // and let an admin handle the final deletion.
            
            await Profile.update(userId, {
                account_status: 'suspended',
                // You could add a 'deletion_requested_at' field to your schema
            });

            // You could also trigger an email to the admin team here.
            
            res.json({
                success: true,
                message: 'Your account deletion request has been received. Your account is now suspended and will be permanently deleted by an administrator shortly.'
            });
            
        } catch (error) {
            next(error);
        }
    }

    /**
     * Gets notifications for the currently logged-in user.
     */
    async getMyNotifications(req, res, next) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 10 } = req.query;

            const { data, error, count } = await supabase
                .from('notifications')
                .select('*', { count: 'exact' })
                .eq('recipient_id', userId)
                .order('created_at', { ascending: false })
                .range((page - 1) * limit, page * limit - 1);

            if (error) throw error;

            res.json({
                success: true,
                data,
                pagination: {
                    currentPage: page,
                    limit,
                    totalRecords: count,
                    totalPages: Math.ceil(count / limit),
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Marks notifications as read for the logged-in user.
     */
    async markNotificationsAsRead(req, res, next) {
        try {
            const userId = req.user.id;
            const { notificationIds } = req.body; // Expects an array of IDs

            if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
                return res.status(400).json({ success: false, error: 'notificationIds must be a non-empty array.' });
            }

            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('recipient_id', userId)
                .in('id', notificationIds);

            if (error) throw error;

            res.json({ success: true, message: 'Notifications marked as read.' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ProfileController();