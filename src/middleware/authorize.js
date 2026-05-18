/**
 * authorize.js — JWT Authorization Middleware
 *
 * Verifies the JWT access token from the Authorization header.
 * Optionally restricts access to specific roles.
 *
 * Usage in routes:
 *   authorize()          → any authenticated user
 *   authorize('Admin')   → admin only
 *   authorize(['Admin']) → admin only (array form)
 */
const jwt = require('jsonwebtoken');

module.exports = authorize;

function authorize(roles = []) {
    // Accept a single role string or an array of roles
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return (req, res, next) => {
        // ─── Step 1: Extract the token from the Authorization header ───
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized — no token provided' });
        }

        const token = authHeader.split(' ')[1];

        // ─── Step 2: Verify the JWT token ──────────────────────────────
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Attach the decoded user info to the request object
            // so controllers can access req.user.id, req.user.role, etc.
            req.user = decoded;

        } catch (err) {
            return res.status(401).json({ message: 'Unauthorized — invalid or expired token' });
        }

        // ─── Step 3: Check role authorization (if roles were specified) ─
        if (roles.length > 0 && !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden — insufficient permissions' });
        }

        // ─── Step 4: Authorized — continue to the next middleware/route ─
        next();
    };
}
