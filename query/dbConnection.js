const sql = require('mssql');
const path = require('path');
const fs = require('fs');

// Database configurations
const dbConfigs = {
    remote: {
        user: 'sa',
        password: 'P@ssw0rd',
        server: '10.0.0.2,1888',
        database: 'databsestaging_PTRJ_iFes_Plangtware',
        options: {
            encrypt: false,
            trustServerCertificate: true,
            connectTimeout: 30000,
            requestTimeout: 30000
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    },
    local: {
        user: 'sa',
        password: 'P@ssw0rd',
        server: 'localhost',
        database: 'databsestaging_PTRJ_iFes_Plangtware',
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    }
};

// Variabel untuk menyimpan pool koneksi
let pool = null;

// Fungsi untuk mendapatkan pool koneksi
async function getPool() {
    if (!pool) {
        console.log('Creating new connection pool...');
        try {
            pool = await sql.connect(dbConfigs.remote);
        } catch (err) {
            console.error('Error connecting to remote database:', err);
            console.log('Trying to connect to local database...');
            try {
                pool = await sql.connect(dbConfigs.local);
            } catch (localErr) {
                console.error('Error connecting to local database:', localErr);
                throw new Error('Failed to connect to any database');
            }
        }
    }
    return pool;
}

// Fungsi untuk menjalankan query dengan error handling
async function executeQuery(query, params = {}) {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('params', sql.VarChar, JSON.stringify(params))
            .query(query);
        return result.recordset;
    } catch (err) {
        console.error('Error executing query:', err);
        throw err;
    }
}

// Fungsi untuk mendapatkan query dari file
function getQueryFromFile(filePath) {
    try {
        const fullPath = path.resolve(__dirname, filePath);
        return fs.readFileSync(fullPath, 'utf8');
    } catch (err) {
        console.error(`Error reading query file ${filePath}:`, err);
        throw err;
    }
}

// Fungsi untuk menutup koneksi
async function closePool() {
    if (pool) {
        try {
            await pool.close();
            pool = null;
            console.log('Connection pool closed');
        } catch (err) {
            console.error('Error closing pool:', err);
        }
    }
}

module.exports = {
    getPool,
    executeQuery,
    getQueryFromFile,
    closePool
}; 