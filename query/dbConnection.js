const sql = require('mssql');
const path = require('path');
const fs = require('fs');

// Database configurations
const dbConfigs = {
    remote: {
        user: 'sa',
        password: 'supp0rt@',
        server: '10.0.0.2',
        port: 1888,
        database: 'db_ptrj',
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
    backup: {
        user: 'sa',
        password: 'P@ssw0rd',
        server: '192.168.1.100,1433', // Alternatif server
        database: 'staging_PTRJ_iFES_Plantware',
        options: {
            encrypt: false,
            trustServerCertificate: true,
            connectTimeout: 15000,
            requestTimeout: 30000
        }
    },
    local: {
        user: 'sa',
        password: 'YourStrong@Passw0rd',
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
        
        // Selalu menggunakan koneksi remote database
        try {
            console.log('Connecting to remote database at 10.0.0.2:1888...');
            pool = await sql.connect(dbConfigs.remote);
            console.log('Connected to remote database successfully');
            return pool;
        } catch (remoteErr) {
            console.error('Error connecting to remote database:', remoteErr);
            
            // Jika gagal, tetap tampilkan error yang lebih informatif dan buat mock pool
            const errorMessage = `
                ====== DATABASE CONNECTION ERROR ======
                Remote: ${remoteErr.message}
                ======================================
                Please check your database configuration or network connection.
            `;
            console.error(errorMessage);
            
            // Buat mock pool untuk mencegah crash aplikasi
            console.log('Creating mock connection pool for fallback operation...');
            pool = {
                request: () => {
                    return {
                        query: async () => {
                            console.log('Using mock query execution (returns empty recordset)');
                            return { recordset: [] };
                        },
                        input: () => {
                            return this;
                        }
                    };
                },
                close: () => {
                    console.log('Closing mock connection pool');
                    pool = null;
                }
            };
            // Tetap tampilkan error di konsol tetapi kembalikan mock pool untuk mencegah crash
            console.warn('ATTENTION: Using mock database connection. NO ACTUAL DATA WILL BE RETURNED!');
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
            console.log('Closing database connection pool...');
            await pool.close();
            pool = null;
            console.log('Connection pool closed and reset to null');
        } catch (err) {
            console.error('Error closing pool:', err);
            // Tetap set pool ke null agar koneksi baru dibuat berikutnya
            pool = null;
            console.log('Pool set to null despite close error');
        }
    } else {
        console.log('No active connection pool to close');
    }
}

module.exports = {
    getPool,
    executeQuery,
    getQueryFromFile,
    closePool
}; 