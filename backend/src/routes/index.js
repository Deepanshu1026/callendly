const express = require('express');
const { body } = require('express-validator');
const passport = require('passport');
const router = express.Router();

const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const calendarController = require('../controllers/calendarController');
const eventTypeController = require('../controllers/eventTypeController');
const availabilityController = require('../controllers/availabilityController');
const bookingController = require('../controllers/bookingController');
const teamController = require('../controllers/teamController');
const integrationController = require('../controllers/integrationController');
const webhookController = require('../controllers/webhookController');
const analyticsController = require('../controllers/analyticsController');
const paymentController = require('../controllers/paymentController');
const aiController = require('../controllers/aiController');
const passwordResetController = require('../controllers/passwordResetController');
const dateOverrideController = require('../controllers/dateOverrideController');
const { authenticate, optionalAuth } = require('../middleware/auth');

router.get('/analytics', authenticate, analyticsController.getAnalytics);

// Auth
router.post('/auth/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').optional().trim()
], authController.register);

router.post('/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], authController.login);

router.get('/auth/me', authenticate, authController.getMe);
router.put('/auth/change-password', authenticate, authController.changePassword);

// Google OAuth Login
router.get('/auth/google', passport.authenticate('google', { 
  scope: [
    'profile', 
    'email'
  ],
  accessType: 'offline',
  prompt: 'consent'
}));
router.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`, 
    session: false 
  }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`);
    }
    const token = user.token;
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`);
  })(req, res, next);
});

// Google Calendar Connection OAuth
router.get('/auth/google/calendar', (req, res, next) => {
  const state = req.query.state;
  passport.authenticate('google-calendar', { 
    scope: [
      'profile', 
      'email', 
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events'
    ],
    accessType: 'offline',
    prompt: 'consent',
    state: state
  })(req, res, next);
});
router.get('/auth/google/calendar/callback', (req, res, next) => {
  passport.authenticate('google-calendar', { 
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/calendars`, 
    session: false 
  }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/calendars`);
  })(req, res, next);
});

// User / Profile
router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.get('/users/:username/public', userController.getPublicProfile);

// Calendars
router.get('/calendars', authenticate, calendarController.getCalendars);
router.post('/calendars', authenticate, calendarController.connectCalendar);
router.delete('/calendars/:id', authenticate, calendarController.disconnectCalendar);

// Event Types
router.get('/event-types', authenticate, eventTypeController.getEventTypes);
router.post('/event-types', authenticate, eventTypeController.createEventType);
router.put('/event-types/:id', authenticate, eventTypeController.updateEventType);
router.delete('/event-types/:id', authenticate, eventTypeController.deleteEventType);
router.get('/event-types/:username/:slug/public', eventTypeController.getPublicEventType);
router.post('/event-types/:eventTypeId/questions', authenticate, eventTypeController.createQuestion);
router.put('/event-types/:eventTypeId/questions/:questionId', authenticate, eventTypeController.updateQuestion);
router.delete('/event-types/:eventTypeId/questions/:questionId', authenticate, eventTypeController.deleteQuestion);

// Availability
router.get('/availability', authenticate, availabilityController.getAvailability);
router.post('/availability', authenticate, availabilityController.setAvailability);
router.get('/availability/:username/:slug/slots', availabilityController.getAvailableSlots);
router.get('/availability/guest/:token/slots', availabilityController.getGuestAvailableSlots);

// Bookings
router.get('/bookings', authenticate, bookingController.getBookings);
router.post('/bookings/:username/:slug', bookingController.createBooking);

// Guest Cancel/Reschedule (must be before /bookings/:id/*)
router.put('/bookings/guest/:token/cancel', bookingController.guestCancelBooking);
router.put('/bookings/guest/:token/reschedule', bookingController.guestRescheduleBooking);

router.put('/bookings/:id/cancel', authenticate, bookingController.cancelBooking);
router.put('/bookings/:id/reschedule', authenticate, bookingController.rescheduleBooking);

// Workspaces & Teams
router.get('/workspaces', authenticate, teamController.getWorkspaces);
router.post('/workspaces', authenticate, teamController.createWorkspace);
router.get('/workspaces/:workspaceId/teams', authenticate, teamController.getTeams);
router.post('/workspaces/:workspaceId/teams', authenticate, teamController.createTeam);
router.get('/teams/:teamId/members', authenticate, teamController.getTeamMembers);
router.post('/teams/:teamId/members', authenticate, teamController.addTeamMember);

// Integrations
router.get('/integrations', authenticate, integrationController.getIntegrations);
router.post('/integrations', authenticate, integrationController.saveIntegration);
router.delete('/integrations/:id', authenticate, integrationController.deleteIntegration);

// Webhooks
router.get('/webhooks', authenticate, webhookController.getWebhooks);
router.post('/webhooks', authenticate, webhookController.createWebhook);
router.delete('/webhooks/:id', authenticate, webhookController.deleteWebhook);

// Payments
router.post('/payments/create-order', paymentController.createOrder);
router.post('/payments/verify', paymentController.verifyPayment);

// AI Features
router.post('/ai/suggest-slots', authenticate, aiController.suggestAvailability);
router.post('/ai/summarize-meeting', authenticate, aiController.summarizeMeeting);

// Password Reset
router.post('/auth/forgot-password', [body('email').isEmail().normalizeEmail()], passwordResetController.forgotPassword);
router.post('/auth/reset-password', [body('password').isLength({ min: 6 })], passwordResetController.resetPassword);

// Event Type Duplication
router.post('/event-types/:id/duplicate', authenticate, eventTypeController.duplicateEventType);

// Event Type Edit (PUT for update was already defined, adding toggle active)
router.put('/event-types/:id/toggle', authenticate, eventTypeController.toggleEventType);

// Date Overrides
router.get('/date-overrides', authenticate, dateOverrideController.getDateOverrides);
router.post('/date-overrides', authenticate, dateOverrideController.createDateOverride);
router.delete('/date-overrides/:id', authenticate, dateOverrideController.deleteDateOverride);

// Booking Approval
router.put('/bookings/:id/approve', authenticate, bookingController.approveBooking);
router.put('/bookings/:id/decline', authenticate, bookingController.declineBooking);

// Booking .ics Download
router.get('/bookings/:id/ics', optionalAuth, bookingController.downloadICS);

// No-show tracking
router.put('/bookings/:id/no-show', authenticate, bookingController.markNoShow);

module.exports = router;
