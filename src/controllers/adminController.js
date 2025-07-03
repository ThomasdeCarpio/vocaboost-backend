// src/controllers/adminController.js

// Import Models - The controller now uses these instead of direct Supabase calls
const Profile = require('../models/Profile');
const ProfileExtensions = require('../models/ProfileExtensions');
// We would create these models for a full implementation
// const Report = require('../models/Report'); 
// const AuditLog = require('../models/AuditLog');

// Import Services
const emailService = require('../services/emailService');
const supabase = require('../config/database'); // Still needed for specific RPC calls or direct access when models aren't built yet

class AdminController {

    // [USC18] Ban/Unban account
    async banAccount(req, res, next) {
        try {
            const adminId = req.user.id;
            const { userId, reason } = req.body;
            
            // 1. Fetch profile using the Model
            const targetProfile = await Profile.findById(userId);
            if (!targetProfile) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            
            // 2. Business Logic: Prevent banning other admins
            if (targetProfile.role === 'admin') {
                return res.status(403).json({ success: false, error: 'Cannot ban another admin' });
            }
            
            // 3. Update profile status using the Model
            await Profile.update(userId, {
                account_status: 'suspended',
            });
            
            // 4. Log admin action (This would ideally use an AuditLog model)
            // await AuditLog.create({ admin_id: adminId, action: 'ban_account', ... });
            
            // 5. Send notification email via the service
            // const { data: authUser } = await supabase.auth.admin.getUserById(userId);
            // await emailService.sendAccountSuspension({ to: authUser.email, ... });
            
            res.json({ success: true, message: `Account for user ${userId} has been suspended.` });
            
        } catch (error) {
            next(error);
        }
    }
    
    async unbanAccount(req, res, next) {
        try {
            const { userId } = req.body;
            
            // Update profile status using the Model
            const updatedProfile = await Profile.update(userId, {
                account_status: 'active',
            });
            
            // Log admin action...
            
            res.json({ success: true, message: `Account for user ${updatedProfile.id} has been reactivated.` });
            
        } catch (error) {
            next(error);
        }
    }
    
    // [USC19] Approve Teacher Requests
    async getTeacherRequests(req, res, next) {
        try {
            // Use the model to fetch pending requests
            const requests = await ProfileExtensions.getPendingTeacherRequests();
            res.json({ success: true, data: requests });
        } catch (error) {
            next(error);
        }
    }
    
    async reviewTeacherRequest(req, res, next) {
        try {
            const { teacherId } = req.params;
            const { approved, reason } = req.body;
            
            // 1. Update the verification status in the teachers_info table
            await ProfileExtensions.updateTeacherVerification(
                teacherId,
                approved ? 'approved' : 'rejected',
                reason
            );
            
            // 2. If approved, update the user's role in the profiles table
            if (approved) {
                await Profile.update(teacherId, { role: 'teacher' });
            }
            
            // Log admin action...
            // Send notification email...

            const message = approved ? 'Teacher request has been approved.' : 'Teacher request has been rejected.';
            res.json({ success: true, message });
            
        } catch (error) {
            next(error);
        }
    }
    
    // [USC20] Moderate Content
    async getReportedContent(req, res, next) {
        try {
            // This would call a method like `Report.findPending()`
            // For now, we'll keep the direct query as a placeholder.
            const { data, error } = await supabase.from('reports').select('*').eq('status', 'open');
            if (error) throw error;
            res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }
    
    async moderateContent(req, res, next) {
        try {
            const adminId = req.user.id;
            const { reportId } = req.params;
            const { action, reason } = req.body; // e.g., action: 'dismiss', 'remove_content'

            // The full logic here would use a Report model to update the report,
            // and then potentially the VocabularyList or Word model to update the content.

            // Placeholder logic:
            const { data: report, error } = await supabase.from('reports').select('*').eq('id', reportId).single();
            if (error || !report) return res.status(404).json({ success: false, error: 'Report not found' });
            
            // Update the report status
            await supabase.from('reports').update({ status: 'resolved', resolver_id: adminId, reason }).eq('id', reportId);

            // If action is to remove, find the content and update its status
            if (action === 'remove_content') {
                 // e.g., await VocabularyList.update(report.content_id, { status: 'removed' });
            }

            // Log admin action...
            
            res.json({ success: true, message: 'Content report has been resolved.' });
            
        } catch (error) {
            next(error);
        }
    }
    
    // [USC21] View system analytics
    async getSystemAnalytics(req, res, next) {
        try {
            // RPC calls are a great way to handle complex aggregations.
            // Keeping them here is fine, as they are a form of "data fetching."
            const { data: userStats, error: userError } = await supabase.rpc('get_user_statistics');
            if (userError) throw userError;

            // ... other analytics queries ...
            const analyticsData = {
                users: {
                    total: userStats?.total_users || 0,
                    byRole: userStats?.users_by_role || {},
                },
                //...
            };

            res.json({ success: true, data: analyticsData });

        } catch (error) {
            next(error);
        }
    }

    // --- Additional User Management Methods ---

    // List all users with pagination and filtering
    async listUsers(req, res, next) {
        try {
            const { page = 1, limit = 20, search, role, status } = req.query;
            
            // This is a complex query that could live in the Profile model.
            // Example: `const result = await Profile.listAll({ page, limit, ...filters });`
            // For now, keeping it here is acceptable.
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            let query = supabase
                .from('profiles')
                .select('*', { count: 'exact' })
                .order('id') // Assuming you want a stable order
                .range(from, to);

            if (search) query = query.ilike('display_name', `%${search}%`);
            if (role) query = query.eq('role', role);
            if (status) query = query.eq('account_status', status);

            const { data: profiles, error, count } = await query;
            if (error) throw error;
            
            res.json({
                success: true,
                data: profiles,
                pagination: {
                    currentPage: parseInt(page),
                    limit: parseInt(limit),
                    totalRecords: count,
                    totalPages: Math.ceil(count / limit)
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // Update a user's details by an admin
    async updateUserByAdmin(req, res, next) {
        try {
            const { userId } = req.params;
            const { role, account_status, display_name } = req.body;

            const updatedProfile = await Profile.update(userId, {
                role,
                account_status,
                display_name,
            });

            res.json({ success: true, data: updatedProfile });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AdminController();