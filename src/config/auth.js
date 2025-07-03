const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

// Supabase client and our new Profile model are now the sources of truth
const supabase = require('./database'); 
const Profile = require('../models/Profile'); 

/**
 * JWT Strategy Configuration
 * Verifies JWTs that our Express server has issued.
 */
const configureJwtStrategy = () => {
  const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
    passReqToCallback: true
  };

  passport.use('jwt', new JwtStrategy(options, async (req, payload, done) => {
    try {
      // Validate the payload from our own token
      if (!payload.userId || !payload.email) {
        return done(null, false, { message: 'Invalid token payload' });
      }

      // Fetch the user's profile from our 'profiles' table
      const profile = await Profile.findById(payload.userId);
      
      if (!profile) {
        return done(null, false, { message: 'User not found' });
      }

      // Check account status from the 'profiles' table
      if (profile.account_status === 'suspended') {
        return done(null, false, { message: `Account is suspended` });
      }

      // Attach full profile to request object
      req.user = profile;
      return done(null, profile);
    } catch (error) {
      console.error('JWT Strategy Error:', error);
      return done(error, false);
    }
  }));
};

/**
 * Google OAuth2 Strategy Configuration
 * Handles the OAuth flow, finds or creates a user in Supabase Auth,
 * and then finds or creates their corresponding public profile.
 */
const configureGoogleStrategy = () => {
  if (process.env.NODE_ENV === 'test') return;

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('Google OAuth credentials not configured. Skipping Google Strategy.');
    return;
  }

  const options = {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
    scope: ['profile', 'email'],
    passReqToCallback: true
  };

  passport.use('google', new GoogleStrategy(options, async (req, accessToken, refreshToken, profile, done) => {
    try {
      if (!profile.emails || !profile.emails[0]) {
        return done(null, false, { message: 'No email found in Google profile' });
      }

      const email = profile.emails[0].value;
      const googleProfileData = {
        email: email,
        display_name: profile.displayName,
        // avatar_url could be here, but Supabase handles it via identity data
      };

      // 1. Check if user exists in Supabase Auth
      const { data: { user: existingAuthUser }, error: findError } = await supabase.auth.admin.getUserByEmail(email);
      
      if (findError && findError.status !== 404) {
          throw findError; // Throw actual errors
      }

      let authUser = existingAuthUser;
      let userProfile;

      if (authUser) { // User exists in Supabase Auth
        // User already exists, fetch their public profile
        userProfile = await Profile.findById(authUser.id);
        if (!userProfile) {
            // This is a recovery case: auth user exists but profile is missing. Create it.
            userProfile = await Profile.create({
                id: authUser.id,
                display_name: googleProfileData.display_name,
                role: 'learner', // Default role
                account_status: 'active'
            });
        }
      } else { // User does NOT exist in Supabase Auth, create them
        const { data: { user: newAuthUser }, error: createError } = await supabase.auth.admin.createUser({
          email: email,
          email_confirm: true, // Google emails are pre-verified
          user_metadata: {
            display_name: googleProfileData.display_name,
            avatar_url: profile.photos?.[0]?.value || null,
          }
        });

        if (createError) {
          console.error('Supabase admin.createUser error:', createError);
          return done(createError, false);
        }
        
        authUser = newAuthUser;

        // Now, create their corresponding public profile
        userProfile = await Profile.create({
          id: authUser.id,
          display_name: googleProfileData.display_name,
          role: 'learner', // Default role on first sign-up
          account_status: 'active'
        });
      }

      // At this point, we have a valid authUser and userProfile
      // Check for suspension
      if (userProfile.account_status === 'suspended') {
        return done(null, false, { message: 'Account is suspended' });
      }
      
      // Update last seen timestamp
      await Profile.update(userProfile.id, { last_seen_at: new Date() });

      return done(null, userProfile);

    } catch (error) {
      console.error('Google Strategy Error:', error);
      return done(error, false);
    }
  }));
};

/**
 * Serialize user for session management (used in OAuth flow).
 * Stores only the user's ID in the session to keep it lightweight.
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

/**
 * Deserialize user from session.
 * Fetches the full user profile from the database using the ID from the session.
 */
passport.deserializeUser(async (id, done) => {
  try {
    const profile = await Profile.findById(id);
    done(null, profile); // Passport attaches this to req.user
  } catch (error) {
    console.error('Deserialize user error:', error);
    done(error, null);
  }
});

/**
 * Initialize all Passport strategies.
 */
const initializePassport = () => {
  configureJwtStrategy();
  configureGoogleStrategy();
};

// Initialize strategies when this module is loaded
initializePassport();

module.exports = passport;