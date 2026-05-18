/**
 * auth.routes.js — Authentication Routes
 *
 * Maps HTTP endpoints to auth controller functions.
 * All routes are under the /accounts prefix (set in server.js).
 *
 * Public routes (no auth required):
 *   POST /register        → create a new account
 *   POST /verify-email    → verify email with token
 *   POST /authenticate    → login
 *   POST /refresh-token   → refresh JWT using cookie
 *   POST /forgot-password → send reset email
 *   POST /validate-reset-token → check if reset token is valid
 *   POST /reset-password  → set new password
 *
 * Authenticated routes:
 *   POST /revoke-token    → logout (invalidate refresh token)
 */
const express = require('express');
const router = express.Router();
const authorize = require('../middleware/authorize');
const authController = require('../controllers/auth.controller');

// ─── Public routes ──────────────────────────────────────
router.post('/register',            authController.registerSchema,          authController.register);
router.post('/verify-email',        authController.verifyEmailSchema,       authController.verifyEmail);
router.post('/authenticate',        authController.authenticateSchema,      authController.authenticate);
router.post('/refresh-token',       authController.refreshToken);
router.post('/forgot-password',     authController.forgotPasswordSchema,    authController.forgotPassword);
router.post('/validate-reset-token', authController.validateResetTokenSchema, authController.validateResetToken);
router.post('/reset-password',      authController.resetPasswordSchema,     authController.resetPassword);

// ─── Authenticated routes ───────────────────────────────
router.post('/revoke-token',        authorize(),                            authController.revokeTokenSchema, authController.revokeToken);

module.exports = router;
