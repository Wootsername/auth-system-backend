/**
 * auth.controller.js — Authentication Controller
 *
 * Handles all authentication-related operations:
 *   - Register (with email verification via Ethereal)
 *   - Verify email
 *   - Login (authenticate) → JWT access token + refresh token cookie
 *   - Refresh token → rotate refresh token, issue new JWT
 *   - Revoke token → invalidate refresh token
 *   - Forgot password → send reset email
 *   - Validate reset token
 *   - Reset password
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Joi = require('joi');
const db = require('../_helpers/db');
const { sendEmail } = require('../services/email.service');
const validateRequest = require('../middleware/validate-request');

module.exports = {
    registerSchema,
    register,
    verifyEmailSchema,
    verifyEmail,
    authenticateSchema,
    authenticate,
    refreshToken,
    revokeTokenSchema,
    revokeToken,
    forgotPasswordSchema,
    forgotPassword,
    validateResetTokenSchema,
    validateResetToken,
    resetPasswordSchema,
    resetPassword
};

// ═══════════════════════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════════════════════

function registerSchema(req, res, next) {
    const schema = Joi.object({
        title: Joi.string().allow('').optional(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        acceptTerms: Joi.boolean().valid(true).optional()
    });
    validateRequest(req, next, schema);
}

async function register(req, res, next) {
    try {
        const pool = db.getPool();
        const { title, firstName, lastName, email, password } = req.body;

        // Check if email is already registered
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            // Return OK to prevent email enumeration (security best practice)
            return res.json({ message: 'Registration successful, please check your email for verification instructions' });
        }

        // Hash the password (10 salt rounds)
        const passwordHash = await bcrypt.hash(password, 10);

        // Generate a random verification token
        const verificationToken = crypto.randomBytes(40).toString('hex');

        // Determine the role: first user becomes Admin, all others are User
        const [countResult] = await pool.query('SELECT COUNT(*) as count FROM users');
        const role = countResult[0].count === 0 ? 'Admin' : 'User';

        // Insert the new user into the database
        await pool.query(
            `INSERT INTO users (title, firstName, lastName, email, passwordHash, role, verificationToken, isVerified)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
            [title || '', firstName, lastName, email, passwordHash, role, verificationToken]
        );

        // Send verification email via Ethereal
        const verifyUrl = `${process.env.CORS_ORIGIN}/account/verify-email?token=${verificationToken}`;
        await sendEmail({
            to: email,
            subject: 'Auth System — Verify Your Email',
            html: `
                <h2>Email Verification</h2>
                <p>Thanks for registering, ${firstName}!</p>
                <p>Please click the link below to verify your email address:</p>
                <p><a href="${verifyUrl}">${verifyUrl}</a></p>
                <p>If you did not register, please ignore this email.</p>
            `
        });

        res.json({ message: 'Registration successful, please check your email for verification instructions' });

    } catch (err) {
        next(err);
    }
}

// ═══════════════════════════════════════════════════════════
// VERIFY EMAIL
// ═══════════════════════════════════════════════════════════

function verifyEmailSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

async function verifyEmail(req, res, next) {
    try {
        const pool = db.getPool();
        const { token } = req.body;

        // Find the user with this verification token
        const [users] = await pool.query(
            'SELECT id FROM users WHERE verificationToken = ?',
            [token]
        );

        if (users.length === 0) {
            throw 'Verification failed — invalid token';
        }

        // Mark the user as verified
        await pool.query(
            'UPDATE users SET isVerified = 1, verified = NOW(), verificationToken = NULL WHERE id = ?',
            [users[0].id]
        );

        res.json({ message: 'Verification successful, you can now login' });

    } catch (err) {
        next(err);
    }
}

// ═══════════════════════════════════════════════════════════
// AUTHENTICATE (LOGIN)
// ═══════════════════════════════════════════════════════════

function authenticateSchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

async function authenticate(req, res, next) {
    try {
        const pool = db.getPool();
        const { email, password } = req.body;

        // Find the user by email (include passwordHash for comparison)
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        const user = users[0];

        // Validate user exists, is verified, and password matches
        if (!user || !user.isVerified || !(await bcrypt.compare(password, user.passwordHash))) {
            throw 'Email or password is incorrect';
        }

        // Generate JWT access token (expires in 15 minutes)
        const jwtToken = generateJwtToken(user);

        // Generate refresh token (expires in 7 days)
        const refreshToken = generateRefreshToken();

        // Save the refresh token to the database
        await pool.query(
            'UPDATE users SET refreshToken = ?, refreshTokenExpires = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE id = ?',
            [refreshToken, user.id]
        );

        // Set the refresh token as an httpOnly cookie
        setRefreshTokenCookie(res, refreshToken);

        // Return the user details + JWT token
        res.json({
            ...basicDetails(user),
            jwtToken
        });

    } catch (err) {
        next(err);
    }
}

// ═══════════════════════════════════════════════════════════
// REFRESH TOKEN
// ═══════════════════════════════════════════════════════════

async function refreshToken(req, res, next) {
    try {
        const pool = db.getPool();

        // Get refresh token from the httpOnly cookie
        const token = req.cookies.refreshToken;
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized — no refresh token' });
        }

        // Find the user with this refresh token
        const [users] = await pool.query(
            'SELECT * FROM users WHERE refreshToken = ? AND refreshTokenExpires > NOW()',
            [token]
        );
        const user = users[0];

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized — invalid or expired refresh token' });
        }

        // Generate new tokens (token rotation — old token is replaced)
        const newJwtToken = generateJwtToken(user);
        const newRefreshToken = generateRefreshToken();

        // Update the refresh token in the database (old one is revoked)
        await pool.query(
            'UPDATE users SET refreshToken = ?, refreshTokenExpires = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE id = ?',
            [newRefreshToken, user.id]
        );

        // Set the new refresh token cookie
        setRefreshTokenCookie(res, newRefreshToken);

        // Return user details + new JWT
        res.json({
            ...basicDetails(user),
            jwtToken: newJwtToken
        });

    } catch (err) {
        next(err);
    }
}

// ═══════════════════════════════════════════════════════════
// REVOKE TOKEN (LOGOUT)
// ═══════════════════════════════════════════════════════════

function revokeTokenSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().allow('').optional()
    });
    validateRequest(req, next, schema);
}

async function revokeToken(req, res, next) {
    try {
        const pool = db.getPool();

        // Token can come from body or cookie
        const token = req.body.token || req.cookies.refreshToken;
        if (!token) {
            return res.status(400).json({ message: 'Token is required' });
        }

        // Clear the refresh token from the database
        const [result] = await pool.query(
            'UPDATE users SET refreshToken = NULL, refreshTokenExpires = NULL WHERE refreshToken = ?',
            [token]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        // Clear the cookie
        res.clearCookie('refreshToken', {
            httpOnly: true,
            sameSite: 'None',
            secure: true
        });

        res.json({ message: 'Token revoked' });

    } catch (err) {
        next(err);
    }
}

// ═══════════════════════════════════════════════════════════
// FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════

function forgotPasswordSchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().email().required()
    });
    validateRequest(req, next, schema);
}

async function forgotPassword(req, res, next) {
    try {
        const pool = db.getPool();
        const { email } = req.body;

        // Find the user (always return OK to prevent email enumeration)
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        const user = users[0];

        if (!user) {
            return res.json({ message: 'Please check your email for password reset instructions' });
        }

        // Generate reset token (expires in 24 hours)
        const resetToken = crypto.randomBytes(40).toString('hex');
        await pool.query(
            'UPDATE users SET resetToken = ?, resetTokenExpires = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?',
            [resetToken, user.id]
        );

        // Send reset email via Ethereal
        const resetUrl = `${process.env.CORS_ORIGIN}/account/reset-password?token=${resetToken}`;
        await sendEmail({
            to: email,
            subject: 'Auth System — Reset Your Password',
            html: `
                <h2>Password Reset</h2>
                <p>Hi ${user.firstName},</p>
                <p>Please click the link below to reset your password. This link is valid for 24 hours:</p>
                <p><a href="${resetUrl}">${resetUrl}</a></p>
                <p>If you did not request a password reset, please ignore this email.</p>
            `
        });

        res.json({ message: 'Please check your email for password reset instructions' });

    } catch (err) {
        next(err);
    }
}

// ═══════════════════════════════════════════════════════════
// VALIDATE RESET TOKEN
// ═══════════════════════════════════════════════════════════

function validateResetTokenSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

async function validateResetToken(req, res, next) {
    try {
        const pool = db.getPool();
        const { token } = req.body;

        const [users] = await pool.query(
            'SELECT id FROM users WHERE resetToken = ? AND resetTokenExpires > NOW()',
            [token]
        );

        if (users.length === 0) {
            throw 'Invalid token';
        }

        res.json({ message: 'Token is valid' });

    } catch (err) {
        next(err);
    }
}

// ═══════════════════════════════════════════════════════════
// RESET PASSWORD
// ═══════════════════════════════════════════════════════════

function resetPasswordSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    });
    validateRequest(req, next, schema);
}

async function resetPassword(req, res, next) {
    try {
        const pool = db.getPool();
        const { token, password } = req.body;

        // Find the user with this reset token
        const [users] = await pool.query(
            'SELECT id FROM users WHERE resetToken = ? AND resetTokenExpires > NOW()',
            [token]
        );

        if (users.length === 0) {
            throw 'Invalid token';
        }

        // Hash the new password
        const passwordHash = await bcrypt.hash(password, 10);

        // Update the password and clear the reset token
        await pool.query(
            'UPDATE users SET passwordHash = ?, resetToken = NULL, resetTokenExpires = NULL, isVerified = 1 WHERE id = ?',
            [passwordHash, users[0].id]
        );

        res.json({ message: 'Password reset successful, you can now login' });

    } catch (err) {
        next(err);
    }
}

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Generate a JWT access token (expires in 15 minutes).
 * The Angular frontend reads the 'exp' and 'id' claims from this token.
 */
function generateJwtToken(user) {
    return jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );
}

/**
 * Generate a random refresh token string.
 */
function generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
}

/**
 * Set the refresh token as an httpOnly cookie.
 * - httpOnly: true   → JavaScript cannot read it (XSS protection)
 * - sameSite: 'None' → allows cross-origin cookies (frontend on Netlify, backend on Render)
 * - secure: true     → only sent over HTTPS (required when sameSite is 'None')
 * - maxAge: 7 days   → matches the refresh token expiry
 */
function setRefreshTokenCookie(res, token) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', token, {
        httpOnly: true,
        sameSite: isProduction ? 'None' : 'Lax',
        secure: isProduction,
        maxAge: 7 * 24 * 60 * 60 * 1000,   // 7 days in milliseconds
        path: '/'
    });
}

/**
 * Extract safe user details for the API response.
 * Never includes passwordHash, tokens, or other sensitive data.
 * Matches what the Angular frontend expects.
 */
function basicDetails(user) {
    return {
        id: user.id,
        title: user.title,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isVerified: !!user.isVerified,
        dateCreated: user.created
    };
}
