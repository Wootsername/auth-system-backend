/**
 * db.js — MySQL Database Connection (mysql2)
 *
 * Connects to MySQL using mysql2/promise with connection pooling.
 * Supports Aiven SSL via ca.pem file or DB_SSL_CA_CONTENT env var.
 * Auto-creates the users table on first run.
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

let pool;

/**
 * Get or create the MySQL connection pool.
 * Called once on first use, then reuses the same pool.
 */
function getPool() {
    if (pool) return pool;

    // ─── SSL Configuration (required for Aiven) ─────────
    let ssl = undefined;

    if (process.env.DB_SSL_CA_CONTENT) {
        // OPTION 1: CA cert content stored as environment variable (for Render)
        // Write it to a temp file so mysql2 can read it
        const tmpCaPath = path.join(__dirname, '../../tmp_ca.pem');
        fs.writeFileSync(tmpCaPath, process.env.DB_SSL_CA_CONTENT.replace(/\\n/g, '\n'));
        ssl = { ca: fs.readFileSync(tmpCaPath) };
        console.log('🔒 SSL enabled (from DB_SSL_CA_CONTENT env var)');
    } else if (process.env.DB_SSL_CA) {
        // OPTION 2: CA cert file path (for local dev with Aiven)
        const caPath = path.resolve(process.env.DB_SSL_CA);
        if (fs.existsSync(caPath)) {
            ssl = { ca: fs.readFileSync(caPath) };
            console.log('🔒 SSL enabled (from ca.pem file)');
        } else {
            console.warn('⚠️  DB_SSL_CA is set but file not found:', caPath);
        }
    }

    // ─── Create Connection Pool ─────────────────────────
    pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    return pool;
}

/**
 * Initialize the database — create the users table if it doesn't exist.
 * Called once when the server starts up.
 */
async function initialize() {
    const pool = getPool();

    // Test the connection
    const connection = await pool.getConnection();
    console.log(`✅ Connected to MySQL: ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME}`);
    connection.release();

    // Create the users table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(10),
            firstName VARCHAR(100) NOT NULL,
            lastName VARCHAR(100) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            passwordHash VARCHAR(255) NOT NULL,
            role ENUM('Admin', 'User') NOT NULL DEFAULT 'User',
            verificationToken VARCHAR(255),
            isVerified TINYINT(1) NOT NULL DEFAULT 0,
            verified DATETIME,
            resetToken VARCHAR(255),
            resetTokenExpires DATETIME,
            refreshToken VARCHAR(255),
            refreshTokenExpires DATETIME,
            created DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    console.log('✅ Users table ready');
}

// Export the pool getter and initialize function
module.exports = { getPool, initialize };
