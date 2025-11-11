const { Pool } = require('pg');

// Parse the PostgreSQL connection string
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:euzfvv6bhljlio8z@82.68.47.77:5566/postgres';

const pool = new Pool({
    connectionString: connectionString,
    ssl: false // Set to true if your PostgreSQL server requires SSL
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err);
    } else {
        console.log('✅ Connected to PostgreSQL database');
    }
});

// Initialize database tables
async function initDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create ticket_categories table
        await client.query(`
            CREATE TABLE IF NOT EXISTS ticket_categories (
                id SERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                name TEXT NOT NULL,
                roles TEXT
            )
        `);

        // Create ticket_panels table
        await client.query(`
            CREATE TABLE IF NOT EXISTS ticket_panels (
                id SERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                message_id TEXT NOT NULL,
                title TEXT,
                description TEXT,
                categories TEXT,
                config_name TEXT
            )
        `);

        // Create active_tickets table
        await client.query(`
            CREATE TABLE IF NOT EXISTS active_tickets (
                id SERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                category TEXT,
                created_at TEXT,
                status TEXT DEFAULT 'open',
                form_data TEXT
            )
        `);

        // Create ticket_alerts table
        await client.query(`
            CREATE TABLE IF NOT EXISTS ticket_alerts (
                id SERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                UNIQUE(guild_id, user_id)
            )
        `);

        await client.query('COMMIT');
        console.log('✅ Database tables initialized!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Database initialization error:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Database wrapper functions to match SQLite interface
const db = {
    // Execute a query without returning results
    exec: async (sql) => {
        const client = await pool.connect();
        try {
            await client.query(sql);
        } finally {
            client.release();
        }
    },

    // Prepare a statement
    prepare: (sql) => {
        return {
            // Run a query and return info
            run: async (...params) => {
                const client = await pool.connect();
                try {
                    // Convert ? placeholders to $1, $2, etc.
                    let paramIndex = 1;
                    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
                    const result = await client.query(pgSql, params);
                    return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
                } finally {
                    client.release();
                }
            },

            // Get a single row
            get: async (...params) => {
                const client = await pool.connect();
                try {
                    let paramIndex = 1;
                    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
                    const result = await client.query(pgSql, params);
                    return result.rows[0] || null;
                } finally {
                    client.release();
                }
            },

            // Get all rows
            all: async (...params) => {
                const client = await pool.connect();
                try {
                    let paramIndex = 1;
                    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
                    const result = await client.query(pgSql, params);
                    return result.rows;
                } finally {
                    client.release();
                }
            }
        };
    },

    // Pragma (not applicable to PostgreSQL, return empty array)
    pragma: (pragmaCommand) => {
        return [];
    }
};

module.exports = { db, initDatabase, pool };
