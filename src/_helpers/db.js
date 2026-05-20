/**
 * db.js — MySQL Database Connection (mysql2)
 *
 * Connects to MySQL using mysql2/promise with connection pooling.
 * Supports Aiven SSL via ca.pem file or DB_SSL_CA_CONTENT env var.
 * Auto-creates the users table on first run.
 */
const mysql = require('mysql2/promise');

let pool;

/**
 * Get or create the MySQL connection pool.
 * Called once on first use, then reuses the same pool.
 */
function getPool() {
    if (pool) return pool;

    // ─── SSL Configuration ─────────────────────────
    const ssl = { rejectUnauthorized: false };
    console.log('🔒 SSL enabled (rejectUnauthorized: false)');

    // ─── Create Connection Pool ─────────────────────────
    pool = mysql.createPool({
        host: process.env.MYSQLHOST || process.env.DB_HOST,
        port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT) || 3306,
        user: process.env.MYSQLUSER || process.env.DB_USER,
        password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
        database: process.env.MYSQLDATABASE || process.env.DB_NAME,
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
    const host = process.env.MYSQLHOST || process.env.DB_HOST;
    const port = process.env.MYSQLPORT || process.env.DB_PORT || 3306;
    const database = process.env.MYSQLDATABASE || process.env.DB_NAME;
    console.log(`✅ Connected to MySQL: ${host}:${port}/${database}`);
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
