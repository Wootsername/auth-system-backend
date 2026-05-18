/**
 * users.routes.js — User CRUD Routes
 *
 * Maps HTTP endpoints to user controller functions.
 * All routes are under the /accounts prefix (set in server.js).
 * All routes require authentication via the authorize() middleware.
 *
 *   GET    /       → list all users (Admin only)
 *   GET    /:id    → get user by ID
 *   POST   /       → create user (Admin only)
 *   PUT    /:id    → update user
 *   DELETE /:id    → delete user
 */
const express = require('express');
const router = express.Router();
const authorize = require('../middleware/authorize');
const usersController = require('../controllers/users.controller');

// ─── Admin-only routes ──────────────────────────────────
router.get('/',     authorize('Admin'),  usersController.getAll);
router.post('/',    authorize('Admin'),  usersController.createSchema, usersController.create);

// ─── Authenticated routes (own profile or Admin) ────────
router.get('/:id',    authorize(),       usersController.getById);
router.put('/:id',    authorize(),       usersController.updateSchema, usersController.update);
router.delete('/:id', authorize(),       usersController._delete);

module.exports = router;
