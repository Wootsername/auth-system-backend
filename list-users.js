const mysql = require('mysql2/promise');
require('dotenv').config();

async function listUsers() {
    console.log('🔍 Connecting to database...');
    
    const ssl = { rejectUnauthorized: false };

    const connection = await mysql.createConnection({
        host: process.env.MYSQLHOST || process.env.DB_HOST,
        port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306'),
        user: process.env.MYSQLUSER || process.env.DB_USER,
        password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
        database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'defaultdb',
        ssl: ssl
    });

    console.log('✅ Connected! Fetching all accounts in your live database:\n');

    const [rows] = await connection.query('SELECT id, firstName, lastName, email, role, isVerified FROM accounts');
    
    if (rows.length === 0) {
        console.log('⚠️ Your database is currently empty!');
    } else {
        console.table(rows);
    }

    await connection.end();
}

listUsers().catch(err => {
    console.error('❌ Failed to list users:', err);
});
