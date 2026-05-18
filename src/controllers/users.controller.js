/**
 * users.controller.js — User CRUD Controller
 *
 * Handles user management operations (admin-only for list/create):
 *   - GET    /         → list all users (Admin only)
 *   - GET    /:id      → get user by ID (own profile or Admin)
 *   - POST   /         → create a new user (Admin only)
 *   - PUT    /:id      → update user (own profile or Admin)
 *   - DELETE /:id      → delete user (own profile or Admin)
 */
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const db = require('../_helpers/db');
const validateRequest = require('../middleware/validate-request');

module.exports = {
    getAll,
    getById,
    createSchema,
    create,
    updateSchema,
    update,
    _delete
};

// ═══════════════════════════════════════════════════════════
// GET ALL USERS (Admin only)
// ═══════════════════════════════════════════════════════════

async function getAll(req, res, next) {
    try {
        const pool = db.getPool();
        const [users] = await pool.query(
            'SELECT id, title, firstName, lastName, email, role, isVerified, created, updated FROM users'
        );

        // Map database rows to the response format
        const result = users.map(u => ({
            id: u.id,
            title: u.title,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            role: u.role,
            isVerified: !!u.isVerified,
            dateCreated: u.created
        }));

        res.json(result);

    } catch (err) {
        next(err);
    }
}

// ═══════════════════════════════════════════════════════════
// GET USER BY ID
// ═══════════════════════════════════════════════════════════

async function getById(req, res, next) {
    try {
        const pool = db.getPool();
        const id = parseInt(req.params.id);

        // Users can only view their own profile (unless they are Admin)
        if (id !== req.user.id && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const [users] = await pool.query(
            'SELECT id, title, firstName, lastName, email, role, isVerified, created FROM users WHERE id = ?',
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];
        res.json({
            id: user.id,
            title: user.title,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            isVerified: !!user.isVerified,
            dateCreated: user.created
        });

    } catch (err) {
        next(err);
    }
}

// ═══════════════════════════════════════════════════════════
// CREATE USER (Admin only)
// ═══════════════════════════════════════════════════════════

function createSchema(req, res, next) {
    const schema = Joi.object({
        title: Joi.string().allow('').optional(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        role: Joi.string().valid('Admin', 'User').required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    });
    validateRequest(req, next, schema);
}

async function create(req, res, next) {
    try {
        const pool = db.getPool();
        const { title, firstName, lastName, email, role, password } = req.body;

        // Check if email is already registered
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            throw `Email "${email}" is already registered`;
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert the new user (already verified since admin created them)
        await pool.query(
            `INSERT INTO users (title, firstName, lastName, email, passwordHash, role, isVerified, verified)
             VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
            [title || '', firstName, lastName, email, passwordHash, role]
        );

        res.json({ message: 'User created successfully' });

    } catch (err) {
        next(err);
    }
}

// ═══════════════════════════════════════════════════════════
// UPDATE USER
// ═══════════════════════════════════════════════════════════

function updateSchema(req, res, next) {
    const schema = Joi.object({
        title: Joi.string().allow('').optional(),
        firstName: Joi.string().allow('').optional(),
        lastName: Joi.string().allow('').optional(),
        email: Joi.string().email().allow('').optional(),
        role: Joi.string().valid('Admin', 'User').allow('').optional(),
        password: Joi.string().min(6).allow('').optional(),
        confirmPassword: Joi.when('password', {
            is: Joi.string().min(1),
            then: Joi.string().valid(Joi.ref('password')).required(),
            otherwise: Joi.string().allow('').optional()
        })
    });
    validateRequest(req, next, schema);
}

async function update(req, res, next) {
    try {
        const pool = db.getPool();
        const id = parseInt(req.params.id);

        // Users can only update their own profile (unless they are Admin)
        if (id !== req.user.id && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // Check that the user exists
        const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const { title, firstName, lastName, email, role, password } = req.body;

        // If email is being changed, check it's not already taken
        if (email && email !== users[0].email) {
            const [existing] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
            if (existing.length > 0) {
                throw `Email "${email}" is already registered`;
            }
        }

        // Build the update query dynamically (only update provided fields)
        const updates = [];
        const values = [];

        if (title !== undefined)     { updates.push('title = ?');     values.push(title); }
        if (firstName !== undefined) { updates.push('firstName = ?'); values.push(firstName); }
        if (lastName !== undefined)  { updates.push('lastName = ?');  values.push(lastName); }
        if (email !== undefined)     { updates.push('email = ?');     values.push(email); }

        // Only Admin can change roles
        if (role !== undefined && req.user.role === 'Admin') {
            updates.push('role = ?');
            values.push(role);
        }

        // Only update password if provided
        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            updates.push('passwordHash = ?');
            values.push(passwordHash);
        }

        if (updates.length === 0) {
            return res.json({ message: 'Nothing to update' });
        }

        values.push(id);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

        // Return the updated user details
        const [updated] = await pool.query(
            'SELECT id, title, firstName, lastName, email, role, isVerified, created FROM users WHERE id = ?',
            [id]
        );

        res.json({
            id: updated[0].id,
            title: updated[0].title,
            firstName: updated[0].firstName,
            lastName: updated[0].lastName,
            email: updated[0].email,
            role: updated[0].role,
            isVerified: !!updated[0].isVerified,
            dateCreated: updated[0].created
        });

    } catch (err) {
        next(err);
    }
}

// ═══════════════════════════════════════════════════════════
// DELETE USER
// ═══════════════════════════════════════════════════════════

async function _delete(req, res, next) {
    try {
        const pool = db.getPool();
        const id = parseInt(req.params.id);

        // Users can only delete their own account (unless they are Admin)
        if (id !== req.user.id && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });

    } catch (err) {
        next(err);
    }
}
