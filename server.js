/**
 * server.js — Express Application Entry Point
 *
 * Sets up middleware, CORS, Swagger docs, API routes,
 * and initializes the MySQL database on startup.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const errorHandler = require('./src/middleware/error-handler');

const app = express();

// ─── Middleware ──────────────────────────────────────────
app.use(express.json());       // parse JSON request bodies
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());       // parse cookies (needed for refresh tokens)

// ─── CORS ───────────────────────────────────────────────
// Allow the Angular frontend to make requests with cookies
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    credentials: true   // allow cookies to be sent cross-origin
}));

// ─── Swagger API Docs ───────────────────────────────────
const setupSwagger = require('./src/_helpers/swagger');
setupSwagger(app);

// ─── Health Check ───────────────────────────────────────
// Used by Render and uptime monitors to verify the server is alive
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── API Routes ─────────────────────────────────────────
// All auth routes: /accounts/register, /accounts/authenticate, etc.
app.use('/accounts', require('./src/routes/auth.routes'));

// All user CRUD routes: GET /accounts, GET /accounts/:id, etc.
app.use('/accounts', require('./src/routes/users.routes'));

// ─── Global Error Handler ───────────────────────────────
// Must be registered AFTER routes (Express uses order)
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────
const PORT = process.env.PORT || 4000;

// Initialize the database, then start listening
const db = require('./src/_helpers/db');
db.initialize()
    .then(() => {
        app.listen(PORT, () => {
            console.log('');
            console.log('═══════════════════════════════════════════');
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📚 Swagger docs: http://localhost:${PORT}/api-docs`);
            console.log(`❤️  Health check: http://localhost:${PORT}/health`);
            console.log(`🌐 CORS origin:  ${process.env.CORS_ORIGIN || 'http://localhost:4200'}`);
            console.log('═══════════════════════════════════════════');
        });
    })
    .catch(err => {
        console.error('❌ Failed to initialize database:', err.message);
        process.exit(1);
    });
