const sql = require('mssql');
const path = require('path');
const fs = require('fs');

// Database configurations
const dbConfigs = {
    remote: {
        user: 'sa',
        password: 'P@ssw0rd',
        server: '10.0.0.2,1888',
        database: 'staging_PTRJ_iFES_Plantware',
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
        database: 'staging_PTRJ_iFES_Plantware',
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
        console.log('Executing SQL query...');
        const pool = await getPool();
        
        // Log query untuk debugging (hapus informasi sensitif)
        const queryPreview = query.substring(0, 200) + (query.length > 200 ? '...' : '');
        console.log(`Query preview: ${queryPreview}`);
        
        const request = pool.request();
        
        // Tambahkan parameter jika ada
        if (Object.keys(params).length > 0) {
            request.input('params', sql.VarChar, JSON.stringify(params));
        }
        
        const result = await request.query(query);
        console.log(`Query executed successfully. Returned ${result.recordset ? result.recordset.length : 0} records.`);
        
        return result.recordset || [];
    } catch (err) {
        console.error('Error executing query:', err);
        console.error('Error details:', err.message);
        
        // Jika error terkait koneksi database, coba buat koneksi baru
        if (err.code === 'ETIMEOUT' || err.code === 'ECONNCLOSED' || err.code === 'ECONNRESET') {
            console.log('Connection error detected. Resetting connection pool...');
            pool = null; // Reset pool untuk membuat koneksi baru pada panggilan berikutnya
        }
        
        // Return array kosong alih-alih throw error
        console.log('Returning empty array due to query error');
        return [];
    }
}

// Fungsi untuk mendapatkan query dari file
function getQueryFromFile(filePath) {
    try {
        // Gunakan filePath langsung karena sudah berupa path absolut
        console.log(`Reading query file from: ${filePath}`);
        if (!fs.existsSync(filePath)) {
            console.error(`Query file not found: ${filePath}`);
            throw new Error(`Query file not found: ${filePath}`);
        }
        return fs.readFileSync(filePath, 'utf8');
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