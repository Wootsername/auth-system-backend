/**
 * error-handler.js — Global Error Handler
 *
 * Catches all errors thrown by controllers/middleware and returns
 * a consistent JSON response. Must be registered AFTER all routes.
 *
 * Error classification:
 *   - ValidationError  → 400 Bad Request
 *   - String errors    → 400 or 404 (if ends with "not found")
 *   - UnauthorizedError → 401
 *   - Everything else  → 500 Internal Server Error
 */
module.exports = errorHandler;

function errorHandler(err, req, res, next) {
    switch (true) {
        // ─── String-based errors (thrown as: throw 'Some message') ───
        case typeof err === 'string':
            const is404 = err.toLowerCase().endsWith('not found');
            const statusCode = is404 ? 404 : 400;
            return res.status(statusCode).json({ message: err });

        // ─── Joi validation errors ──────────────────────────────────
        case err.name === 'ValidationError':
            return res.status(400).json({ message: err.message });

        // ─── JWT / auth errors ──────────────────────────────────────
        case err.name === 'UnauthorizedError':
            return res.status(401).json({ message: 'Unauthorized' });

        // ─── Known application errors with status code ──────────────
        case err.status !== undefined:
            return res.status(err.status).json({ message: err.message });

        // ─── Unexpected errors ──────────────────────────────────────
        default:
            console.error('❌ Unhandled error:', err);
            return res.status(500).json({ message: err.message || 'Internal server error' });
    }
}
