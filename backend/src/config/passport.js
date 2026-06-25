require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const supabase = require('./database');
const { generateToken, verifyToken } = require('../utils/jwt');
const { sendLoginNotification } = require('../services/notificationService');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // 1. Default Google strategy for authentication (profile/email only)
  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5050/api/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email found'), false);

          console.log('Google OAuth callback for email:', email);

          // Find user by Google ID
          const { data: userByGoogle, error: gError } = await supabase
            .from('users')
            .select('*, user_profiles(*)')
            .eq('googleId', profile.id)
            .maybeSingle();

          if (gError) {
            console.error('Google OAuth: Error finding user by googleId:', gError);
            throw gError;
          }

          let user = userByGoogle;

          if (user) {
            console.log('Google OAuth: Found user by googleId:', user.id);
            if (user.user_profiles && user.user_profiles.length > 0) {
              user.profile = user.user_profiles[0];
            } else {
              user.profile = null;
            }
          }

          if (!user) {
            console.log('Google OAuth: User not found by googleId. Checking email...');
            // Find user by Email
            const { data: userByEmail, error: eError } = await supabase
              .from('users')
              .select('*, user_profiles(*)')
              .eq('email', email)
              .maybeSingle();

            if (eError) {
              console.error('Google OAuth: Error finding user by email:', eError);
              throw eError;
            }

            if (userByEmail) {
              console.log('Google OAuth: Found user by email. Updating googleId for user:', userByEmail.id);
              // Update user with googleId
              const { data: updatedUser, error: uError } = await supabase
                .from('users')
                .update({ googleId: profile.id, updatedAt: new Date().toISOString() })
                .eq('id', userByEmail.id)
                .select('*, user_profiles(*)')
                .single();

              if (uError) {
                console.error('Google OAuth: Error updating user googleId:', uError);
                throw uError;
              }

              user = updatedUser;
              if (user) {
                if (user.user_profiles && user.user_profiles.length > 0) {
                  user.profile = user.user_profiles[0];
                } else {
                  user.profile = null;
                }
              }
            } else {
              console.log('Google OAuth: User not found by email. Creating new user...');
              // Create user
              const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                  id: require('crypto').randomUUID(),
                  email,
                  googleId: profile.id,
                  name: profile.displayName,
                  avatar: profile.photos?.[0]?.value,
                  updatedAt: new Date().toISOString()
                })
                .select()
                .single();

              if (createError) {
                console.error('Google OAuth: Error inserting new user:', createError);
                throw createError;
              }

              console.log('Google OAuth: Created new user:', newUser.id);

              // Create profile
              const username = email.split('@')[0] + Math.floor(Math.random() * 1000);
              const { error: profileError } = await supabase
                .from('user_profiles')
                .insert({
                  id: require('crypto').randomUUID(),
                  userId: newUser.id,
                  username,
                  timezone: 'UTC',
                  updatedAt: new Date().toISOString()
                });

              if (profileError) {
                console.error('Google OAuth: Error inserting profile:', profileError);
                throw profileError;
              }

              // Create default event types
              const { error: eventError } = await supabase
                .from('event_types')
                .insert([
                  { id: require('crypto').randomUUID(), userId: newUser.id, title: '15 Min Meeting', slug: '15min', duration: 15, location: 'Google Meet', color: '#3b82f6', updatedAt: new Date().toISOString() },
                  { id: require('crypto').randomUUID(), userId: newUser.id, title: '30 Min Meeting', slug: '30min', duration: 30, location: 'Zoom', color: '#10b981', updatedAt: new Date().toISOString() },
                  { id: require('crypto').randomUUID(), userId: newUser.id, title: '60 Min Meeting', slug: '60min', duration: 60, location: 'In-person', color: '#f59e0b', updatedAt: new Date().toISOString() }
                ]);

              if (eventError) {
                console.error('Google OAuth: Error inserting event types:', eventError);
                throw eventError;
              }

              // Create default availability rules
              const { error: availabilityError } = await supabase
                .from('availability_rules')
                .insert([
                  { id: require('crypto').randomUUID(), userId: newUser.id, dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() },
                  { id: require('crypto').randomUUID(), userId: newUser.id, dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() },
                  { id: require('crypto').randomUUID(), userId: newUser.id, dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() },
                  { id: require('crypto').randomUUID(), userId: newUser.id, dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() },
                  { id: require('crypto').randomUUID(), userId: newUser.id, dayOfWeek: 5, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() }
                ]);

              if (availabilityError) {
                console.error('Google OAuth: Error inserting availability rules:', availabilityError);
                throw availabilityError;
              }

              // Fetch fully created user
              const { data: fullUser, error: fetchError } = await supabase
                .from('users')
                .select('*, user_profiles(*)')
                .eq('id', newUser.id)
                .single();

              if (fetchError) {
                console.error('Google OAuth: Error fetching fully created user:', fetchError);
                throw fetchError;
              }

              user = fullUser;
              if (user) {
                if (user.user_profiles && user.user_profiles.length > 0) {
                  user.profile = user.user_profiles[0];
                } else {
                  user.profile = null;
                }
              }
            }
          }

          if (!user) {
            throw new Error('User object was not created or loaded successfully');
          }

          sendLoginNotification(user).catch((mailError) => {
            console.error('Google OAuth login notification email error:', mailError);
          });

          const token = generateToken({ userId: user.id, email: user.email });
          console.log('Google OAuth: Successful login/registration, generating token...');
          return done(null, { user, token });
        } catch (error) {
          console.error('Google OAuth Callback Strategy Exception:', error);
          return done(error, false);
        }
      }
    )
  );

  // 2. Google Calendar strategy for connecting calendars (requests calendar scopes)
  passport.use(
    'google-calendar',
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:5050/api/auth/google/calendar/callback',
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const state = req.query.state;
          if (!state) {
            return done(new Error('State parameter with JWT token is missing'), false);
          }

          const decoded = verifyToken(state);
          const userId = decoded.userId;
          if (!userId) {
            return done(new Error('Invalid token: user ID missing'), false);
          }

          console.log('Google Calendar OAuth callback for user:', userId);

          // Fetch user to verify they exist
          const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (userError || !user) {
            throw new Error('User not found');
          }

          // Automatically connect/update Google Calendar credentials
          if (accessToken) {
            console.log('Google Calendar OAuth: Upserting calendar connection for user:', userId);
            try {
              const { data: existingCal } = await supabase
                .from('calendars')
                .select('id')
                .eq('userId', userId)
                .eq('provider', 'google')
                .maybeSingle();

              if (existingCal) {
                const updateCalData = {
                  accessToken,
                  updatedAt: new Date().toISOString()
                };
                if (refreshToken) {
                  updateCalData.refreshToken = refreshToken;
                }
                await supabase
                  .from('calendars')
                  .update(updateCalData)
                  .eq('id', existingCal.id);
                console.log('Google Calendar OAuth: Updated existing calendar connection:', existingCal.id);
              } else {
                const insertCalData = {
                  id: require('crypto').randomUUID(),
                  userId,
                  provider: 'google',
                  name: 'Primary Google Calendar',
                  externalId: profile.id,
                  accessToken,
                  isPrimary: true,
                  updatedAt: new Date().toISOString()
                };
                if (refreshToken) {
                  insertCalData.refreshToken = refreshToken;
                }
                await supabase
                  .from('calendars')
                  .insert(insertCalData);
                console.log('Google Calendar OAuth: Created new calendar connection');
              }
            } catch (calError) {
              console.error('Google Calendar OAuth: Failed to connect/update calendar connection:', calError);
            }
          }

          return done(null, { user });
        } catch (error) {
          console.error('Google Calendar OAuth Callback Strategy Exception:', error);
          return done(error, false);
        }
      }
    )
  );
}

passport.serializeUser((data, done) => done(null, data));
passport.deserializeUser((data, done) => done(null, data));

module.exports = passport;
