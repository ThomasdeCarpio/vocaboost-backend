// src/controllers/authController.js

const supabase = require('../config/database');
const Profile = require('../models/Profile');
const ProfileExtensions = require('../models/ProfileExtensions');
const Token = require('../models/Token');
const EmailService = require('../services/emailService');
const { generateToken, generateVerificationToken } = require('../utils/jwtHelper'); // Assume jwtHelpers is also updated

class AuthController {
    
    /**
     * [USC1] Register a new user with email and password.
     */
    async register(req, res, next) {
        try {
            const { email, password, display_name, role = 'learner' } = req.body;

            // 1. Create the user in Supabase Auth
            const { data: { user: newAuthUser }, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        display_name: display_name,
                        // We store the initial role here so the profile trigger can use it.
                        initial_role: role 
                    }
                }
            });

            if (signUpError) {
                // Handle specific errors like "User already registered"
                if (signUpError.message.includes("User already registered")) {
                    return res.status(409).json({ success: false, error: 'Email already registered' });
                }
                // Pass other Supabase errors to the global handler
                return next(signUpError);
            }
            
            // At this point, Supabase has created the auth.users record.
            // A database trigger should have automatically created the public.profiles record.
            // We just need to fetch it to confirm.
            const newProfile = await Profile.findById(newAuthUser.id);
            if (!newProfile) {
                // This is a failsafe in case the trigger fails.
                console.error("CRITICAL: Profile was not created by trigger for user:", newAuthUser.id);
                return res.status(500).json({ success: false, error: 'Failed to initialize user profile.' });
            }

            // 2. If the role is 'teacher', create the teacher_info record.
            if (role === 'teacher') {
                const { institution, credentials_url } = req.body;
                await ProfileExtensions.createTeacherInfo(newProfile.id, { institution, credentials_url });
            }

            // Supabase handles sending the verification email by default, so no need to do it manually.

            // 3. Generate our own JWT for session management in our app
            const appToken = generateToken({
                userId: newProfile.id, 
                email: newAuthUser.email, 
                role: newProfile.role
            });
            
            res.status(201).json({
                success: true,
                message: 'Registration successful. Please check your email to verify your account.',
                data: {
                    user: newProfile,
                    token: appToken
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * [USC2] Log in a user with email and password.
     */
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            
            // 1. Authenticate with Supabase Auth
            const { data: { user, session }, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                // Use a generic message to prevent leaking info about which field was wrong
                return res.status(401).json({ success: false, error: 'Invalid email or password' });
            }

            // 2. Fetch our application profile to check status and get roles
            const userProfile = await Profile.findById(user.id);

            if (!userProfile) {
                 return res.status(401).json({ success: false, error: 'Invalid credentials. Profile not found.' });
            }
            
            // 3. Check account status
            if (userProfile.account_status === 'suspended') {
                return res.status(403).json({ success: false, error: 'Your account has been suspended.' });
            }
             if (userProfile.account_status === 'pending_verification') {
                return res.status(403).json({ success: false, error: 'Please verify your email before logging in.' });
            }
            
            // 4. Generate our own JWT for session management
            const appToken = generateToken({
                userId: userProfile.id,
                email: user.email,
                role: userProfile.role
            });

            // 5. Update last seen timestamp
            await Profile.update(userProfile.id, { last_seen_at: new Date() });
            
            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: userProfile,
                    token: appToken
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * Handles the callback from Google OAuth after successful authentication.
     * Passport has already found or created the user and profile.
     */
    googleLogin(req, res) {
        // By the time this runs, the passport 'google' strategy is complete.
        // The verified user profile is attached to `req.user`.
        const userProfile = req.user;
        
        // Generate our application's JWT token for the session.
        const appToken = generateToken({
            userId: userProfile.id,
            email: userProfile.email, // The email might not be on the profile, passport should provide it
            role: userProfile.role
        });
        
        // Redirect to the frontend, passing the token so it can be stored.
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        res.redirect(`${frontendUrl}/auth/callback?token=${appToken}`);
    }
    
    /**
     * Handles user logout.
     */
    async logout(req, res, next) {
        try {
            // If using Supabase client-side, the client handles this.
            // If using server-side tokens, we can tell Supabase to sign out the user.
            const { error } = await supabase.auth.signOut();
            
            if (error) throw error;

            res.json({ success: true, message: 'Logout successful' });
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * Initiates the password reset process.
     */
    async forgotPassword(req, res, next) {
        try {
            const { email } = req.body;
            
            // Supabase handles the token generation and email sending internally
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${process.env.FRONTEND_URL}/update-password`,
            });

            if (error) {
                // Even on error, send a success response to prevent email enumeration attacks
                console.error('Forgot password error:', error.message);
            }
            
            // Always return success to the user.
            res.json({
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent.'
            });

        } catch (error) {
            next(error);
        }
    }
    
    /**
     * Finalizes the password reset using a valid session.
     * This is typically done on the frontend after the user clicks the email link.
     * This endpoint is for when a user is already logged in and wants to change their password.
     */
    async updatePassword(req, res, next) {
        try {
            const { newPassword } = req.body;
            const user = req.user; // From authenticateJWT middleware

            // Use Supabase's secure function to update the password for the logged-in user
            const { error } = await supabase.auth.updateUser({ password: newPassword });

            if (error) throw error;
            
            res.json({ success: true, message: 'Password updated successfully.' });
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * Resends the email verification link.
     */
    async resendVerificationEmail(req, res, next) {
        try {
            const { email } = req.body;
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: email,
            });

            if (error) throw error;

            res.json({ success: true, message: 'Verification email resent successfully.' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AuthController();