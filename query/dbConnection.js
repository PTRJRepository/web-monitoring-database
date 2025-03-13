const sql = require('mssql');

// Konfigurasi koneksi database
const dbConfig = {
    server: 'localhost',
    user: 'sa',
    password: 'windows0819',
    database: 'staging_PTRJ_iFES_Plantware',
    options: {
        trustServerCertificate: true,
        encrypt: false
    }
};

// Fungsi untuk membuat koneksi database
async function createConnection() {
    try {
        const pool = await sql.connect(dbConfig);
        console.log('Database connection established');
        return pool;
    } catch (err) {
        console.error('Error connecting to database:', err);
        throw err;
    }
}

// Fungsi untuk menjalankan query
async function executeQuery(query, params = {}) {
    let pool;
    try {
        pool = await createConnection();
        const result = await pool.request()
            .input('currentYear', sql.Int, new Date().getFullYear())
            .query(query);
        return result.recordset;
    } catch (err) {
        console.error('Error executing query:', err);
        throw err;
    } finally {
        if (pool) {
            try {
                await pool.close();
                console.log('Database connection closed');
            } catch (err) {
                console.error('Error closing database connection:', err);
            }
        }
    }
}

module.exports = {
    dbConfig,
    createConnection,
    executeQuery
}; 