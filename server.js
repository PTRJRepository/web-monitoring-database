require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const schedule = require('node-schedule');
const nodemailer = require('nodemailer');
const path = require('path');
const moment = require('moment');
const fs = require('fs');
const session = require('express-session');

// Import modul-modul yang sudah dibuat
const dbModule = require('./query/dbConnection');
const dataModule = require('./query/dataOperations');

// Definisi path untuk direktori data
const dataDir = path.join(__dirname, 'public/data');
const tempDir = path.join(__dirname, 'temp');

// Pastikan direktori ada
[dataDir, tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Load configuration
let appConfig;
try {
    const configPath = path.join(__dirname, 'config.json');
    appConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('Configuration loaded successfully');
} catch (error) {
    console.error('Error loading configuration:', error);
    // Fallback to default config
    appConfig = {
        auth: {
            passkey: "monitoring2024",
            isEnabled: false  // Menonaktifkan autentikasi
        },
        email: {
            sender: {
                email: "atharizki.developer@gmail.com",
                password: "fxjioeubpjfruasy"
            },
            isEnabled: false,
            interval: {
                checkData: 5,
                sendEmail: 180
            },
            recipients: {
                firstTime: "atharizki001@gmail.com",
                interval: "estate_it@rebinmas.com",
                tunjangan_beras: "hrd@rebinmas.com",
                bpjs: "hrd@rebinmas.com",
                gwscanner: "estate_it@rebinmas.com",
                ffbworker: "estate_it@rebinmas.com"
            },
            cc: []
        },
        templates: {
            tunjangan_beras: "Ditemukan ketidaksesuaian pada data tunjangan beras karyawan. Mohon untuk segera ditindaklanjuti.",
            bpjs: "Ditemukan data BPJS yang belum lengkap. Mohon untuk segera ditindaklanjuti.",
            gwscanner: "Ditemukan data duplikat pada GWScanner. Mohon untuk segera ditindaklanjuti.",
            ffbworker: "Ditemukan data pekerja dengan posisi bukan pemanen (non-HAR) yang memiliki data Ripe. Mohon untuk segera diverifikasi."
        }
    };
}

// Load History Tracker
const HistoryTracker = require('./historyTracker');
const historyTracker = new HistoryTracker(path.join(__dirname, 'history', 'unified_history.json'));

const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// Session setup for authentication
app.use(session({
    secret: 'monitoring-database-app-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Trust proxy untuk mendapatkan IP address yang benar
app.set('trust proxy', 'loopback');

// Rate limiting untuk keamanan
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 menit
    max: 100, // limit setiap IP ke 100 request per menit
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: 'loopback',
    handler: function (req, res) {
        res.status(429).json({
            success: false,
            error: 'Terlalu banyak request. Silakan coba lagi dalam beberapa saat.'
        });
    }
});

// Khusus untuk endpoint refresh, gunakan rate limit yang lebih longgar
const refreshLimiter = rateLimit({
    windowMs: 1 * 1000, // 1 detik
    max: 5, // maksimal 5 request per detik
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: 'loopback'
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

// Tambahkan variabel untuk menandai kesiapan data
let dataInitialized = false;

// Fungsi untuk menyimpan data ke temporary file
function saveTempData(type, data) {
    try {
        // Pastikan direktori temp ada
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Simpan data ke file temp
        const tempFile = path.join(tempDir, `${type}_temp.json`);
        fs.writeFileSync(tempFile, JSON.stringify({
            timestamp: new Date(),
            data: data
        }));
        console.log(`Saved temporary ${type} data`);
        return true;
    } catch (error) {
        console.error(`Error saving temporary ${type} data:`, error);
        return false;
    }
}

// Fungsi untuk membaca data dari temporary file
function loadTempData(type) {
    try {
        const tempFile = path.join(tempDir, `${type}_temp.json`);
        if (fs.existsSync(tempFile)) {
            console.log(`Loading temporary data from ${tempFile}`);
            const fileContent = fs.readFileSync(tempFile, 'utf8');
            const data = JSON.parse(fileContent);
            console.log(`Loaded ${data.data ? data.data.length : 0} records from temporary file for ${type}`);
            
            // Pastikan data memiliki struktur yang benar
            if (!data.data) {
                console.warn(`Temporary data for ${type} has invalid structure, missing data property`);
                return null;
            }
            
            return data;
        }
        console.log(`No temporary file found for ${type}`);
        return null;
    } catch (error) {
        console.error(`Error loading temporary ${type} data:`, error);
        return null;
    }
}

// Fungsi untuk memeriksa status data
function checkDataStatus() {
    try {
        const dataTypes = ['tunjangan_beras', 'bpjs', 'gwscanner', 'ffbworker'];
        const status = {
            allDataReady: true,
            dataStatus: {}
        };

        dataTypes.forEach(type => {
            const tempFile = path.join(tempDir, `${type}_temp.json`);
            status.dataStatus[type] = fs.existsSync(tempFile);
            if (!status.dataStatus[type]) {
                status.allDataReady = false;
            }
        });

        return status;
    } catch (error) {
        console.error('Error checking data status:', error);
        return {
            allDataReady: false,
            error: error.message
        };
    }
}

// Modifikasi fungsi authMiddleware untuk menambahkan autentikasi konfigurasi
function authMiddleware(req, res, next) {
    // Bypass autentikasi untuk semua path
    req.session = req.session || {};
    req.session.isAuthenticated = true;
    next();
}

// Apply auth middleware hanya untuk path yang memerlukan otentikasi
app.use((req, res, next) => {
    // Bypass autentikasi untuk semua path
    
    // Jika akses ke halaman utama, pastikan data sudah diinisialisasi
    if (req.path === '/' && !dataInitialized) {
        return res.render('waiting', {
            message: 'Sedang mempersiapkan data. Mohon tunggu sebentar...',
            refreshUrl: '/check-data-status'
        });
    }
    
    next();
});

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
            connectionTimeout: 60000,
            requestTimeout: 60000,
            pool: {
                max: 10,
                min: 0,
                idleTimeoutMillis: 30000
            }
        }
    }
};

let currentDbConfig = dbConfigs.remote;
let pool = null;

// Path untuk menyimpan history query
const historyDir = path.join(__dirname, 'history');
if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
}

// Read the SQL queries from files
const tunjanganBerasQueryPath = path.join(__dirname, 'query', 'Incorrect_Input_ Jatah_Beras_Based_Employee_Child_Count_Ages.sql');
const bpjsQueryPath = path.join(__dirname, 'query', 'Not_Completed_BPJS.sql');
const gwScannerQueryPath = path.join(__dirname, 'query', 'Find_Duplicate_GWScanner.sql');
const ffbWorkerQueryPath = path.join(__dirname, 'query', 'FindLatetsPosEmpCode_CPTRX.sql');

const getTunjanganBerasQuery = fs.readFileSync(tunjanganBerasQueryPath, 'utf8');
const getBpjsQuery = fs.readFileSync(bpjsQueryPath, 'utf8');
const getGwScannerQuery = fs.readFileSync(gwScannerQueryPath, 'utf8');
const getFfbWorkerQuery = fs.readFileSync(ffbWorkerQueryPath, 'utf8');

// Email configuration
let emailConfig = {
    senderEmail: appConfig.email?.sender?.email || "atharizki.developer@gmail.com",
    receiverEmail: appConfig.email?.recipients?.interval || "estate_it@rebinmas.com",
    firstTimeEmail: appConfig.email?.recipients?.firstTime || "atharizki001@gmail.com",
    ccEmail: appConfig.email?.cc?.join(',') || "",
    scheduleInterval: appConfig.email?.interval?.checkData || 5,
    emailInterval: appConfig.email?.interval?.sendEmail || 180,
    emailTemplate: appConfig.templates?.tunjangan_beras || "Ditemukan ketidaksesuaian pada data tunjangan beras karyawan. Mohon untuk segera ditindaklanjuti.",
    isFirstEmail: true,
    isEnabled: appConfig.email?.isEnabled || false,
    queryEmails: {
        tunjangan_beras: appConfig.email?.recipients?.tunjangan_beras || "hrd@rebinmas.com",
        bpjs: appConfig.email?.recipients?.bpjs || "hrd@rebinmas.com",
        gwscanner: appConfig.email?.recipients?.gwscanner || "estate_it@rebinmas.com",
        ffbworker: appConfig.email?.recipients?.ffbworker || "estate_it@rebinmas.com"
    }
};

// Store monitoring state
let monitoringState = {
    lastCheck: null,
    lastEmail: null,
    isActive: true,
    previousData: [],
    currentData: [],
    currentDataType: 'tunjangan', // 'tunjangan' atau 'bpjs' atau 'gwscanner' atau 'ffbworker'
    bpjsData: [],
    gwscannerData: [],
    ffbworkerData: [],
    schedules: {}
};

// Fungsi untuk format tanggal dan waktu
function formatDateTime(dateTime) {
    if (!dateTime) return '-';
    return moment(dateTime).format('DD-MM-YYYY HH:mm:ss');
}

// Function to save query history to JSON files
function saveQueryHistory(queryType, data) {
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const fileName = `${queryType}_${timestamp}.json`;
    const filePath = path.join(historyDir, fileName);
    
    const historyData = {
        timestamp: timestamp,
        queryType: queryType,
        recordCount: data.length,
        data: data
    };
    
    try {
        fs.writeFileSync(filePath, JSON.stringify(historyData, null, 2));
        console.log(`Saved query history to ${filePath}`);
        
        // Also record in unified history tracker
        historyTracker.recordEntries(queryType, data);
    } catch (err) {
        console.error(`Error saving query history: ${err.message}`);
    }
}

// Function to save query results to JSON files for display
function saveQueryResultsToJson(queryType, data) {
    const filePath = path.join(__dirname, 'public', 'data', `${queryType}_results.json`);
    
    try {
        // Pastikan direktori ada
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        
        // Tambahkan timestamp terakhir update
        const resultData = {
            lastUpdated: moment().format('YYYY-MM-DD HH:mm:ss'),
            count: data.length,
            data: data
        };
        
        // Simpan ke file
        fs.writeFileSync(filePath, JSON.stringify(resultData, null, 2));
        console.log(`Saved query results to ${filePath} for display`);
        
        return true;
    } catch (err) {
        console.error(`Error saving query results to JSON: ${err.message}`);
        return false;
    }
}

// Function to get query results from JSON files
function getQueryResultsFromJson(queryType) {
    const filePath = path.join(__dirname, 'public', 'data', `${queryType}_results.json`);
    
    try {
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(fileContent);
        } else {
            console.log(`Results file for ${queryType} not found`);
            return {
                lastUpdated: null,
                count: 0,
                data: []
            };
        }
    } catch (err) {
        console.error(`Error reading query results from JSON: ${err.message}`);
        return {
            lastUpdated: null,
            count: 0,
            data: []
        };
    }
}

// Function to get database pool
async function getPool() {
    try {
        if (pool) {
            try {
                // Test if the pool is still connected
                await pool.request().query('SELECT 1');
                return pool;
            } catch (err) {
                console.log('Existing pool is invalid, creating new pool');
                try {
                    await pool.close();
                } catch (closeErr) {
                    console.error('Error closing pool:', closeErr);
                }
                pool = null;
            }
        }

        console.log('Creating new connection pool...');
        pool = await sql.connect(currentDbConfig);
        return pool;
    } catch (err) {
        console.error('Error creating pool:', err);
        pool = null;
        throw err;
    }
}

// Function to test database connection
async function testDbConnection(config) {
    let testPool = null;
    try {
        console.log('Testing connection to:', config.server + (config.port ? `:${config.port}` : ''));
        testPool = await sql.connect(config);
        await testPool.request().query('SELECT 1');
        console.log('Connection test successful');
        return true;
    } catch (err) {
        console.error('Database connection test failed:', err);
        return false;
    } finally {
        if (testPool) {
            try {
                await testPool.close();
            } catch (err) {
                console.error('Error closing test pool:', err);
            }
        }
    }
}

// Tambahkan endpoint untuk memeriksa status data
app.get('/check-data-status', (req, res) => {
    if (dataInitialized) {
        res.json({ ready: true, redirectUrl: '/' });
    } else {
        res.json({ ready: false });
    }
});

// Tambahkan route untuk login
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Tambahkan route untuk memproses login
app.post('/login', (req, res) => {
    const { password } = req.body;
    
    // Periksa password dari konfigurasi
    const configPassword = appConfig.auth && appConfig.auth.passkey ? appConfig.auth.passkey : 'monitoring2024';
    
    if (password === configPassword) {
        // Set session
        req.session.isAuthenticated = true;
        
        // Redirect ke halaman yang diminta sebelumnya atau ke config
        const redirectTo = req.session.returnTo || '/config';
        delete req.session.returnTo;
        res.redirect(redirectTo);
    } else {
        res.render('login', { error: 'Password salah. Silakan coba lagi.' });
    }
});

// Tambahkan route untuk logout
app.get('/logout', (req, res) => {
    req.session.isAuthenticated = false;
    res.redirect('/');
});

// Tambahkan route untuk halaman konfigurasi
app.get('/config', authMiddleware, (req, res) => {
    res.render('config', {
        lastCheck: formatDateTime(monitoringState.lastCheck),
        lastEmail: formatDateTime(monitoringState.lastEmail),
        isActive: monitoringState.isActive,
        emailConfig
    });
});

// Tambahkan endpoint untuk mendapatkan data
app.get('/api/data', async (req, res) => {
    try {
        // Baca data dari file JSON
        const tunjanganBerasPath = path.join(dataDir, 'tunjangan_beras_results.json');
        const bpjsPath = path.join(dataDir, 'bpjs_results.json');
        const gwscannerPath = path.join(dataDir, 'gwscanner_results.json');
        const ffbworkerPath = path.join(dataDir, 'ffbworker_results.json');
        
        let tunjanganData = [];
        let bpjsData = [];
        let gwscannerData = [];
        let ffbworkerData = [];
        let lastUpdated = null;
        
        try {
            if (fs.existsSync(tunjanganBerasPath)) {
                const fileContent = JSON.parse(fs.readFileSync(tunjanganBerasPath, 'utf8'));
                // Ambil data dari properti data jika ada
                if (fileContent && fileContent.data && Array.isArray(fileContent.data)) {
                    tunjanganData = fileContent.data;
                    lastUpdated = fileContent.lastUpdated;
                } else if (Array.isArray(fileContent)) {
                    // Fallback jika data disimpan langsung sebagai array
                    tunjanganData = fileContent;
                } else {
                    console.warn('Tunjangan beras data is not in expected format, using empty array instead');
                }
            }
        } catch (err) {
            console.error('Error reading tunjangan beras data:', err);
        }
        
        try {
            if (fs.existsSync(bpjsPath)) {
                const fileContent = JSON.parse(fs.readFileSync(bpjsPath, 'utf8'));
                // Ambil data dari properti data jika ada
                if (fileContent && fileContent.data && Array.isArray(fileContent.data)) {
                    bpjsData = fileContent.data;
                    if (!lastUpdated) lastUpdated = fileContent.lastUpdated;
                } else if (Array.isArray(fileContent)) {
                    // Fallback jika data disimpan langsung sebagai array
                    bpjsData = fileContent;
                } else {
                    console.warn('BPJS data is not in expected format, using empty array instead');
                }
            }
        } catch (err) {
            console.error('Error reading BPJS data:', err);
        }
        
        try {
            if (fs.existsSync(gwscannerPath)) {
                const fileContent = JSON.parse(fs.readFileSync(gwscannerPath, 'utf8'));
                // Ambil data dari properti data jika ada
                if (fileContent && fileContent.data && Array.isArray(fileContent.data)) {
                    gwscannerData = fileContent.data;
                    if (!lastUpdated) lastUpdated = fileContent.lastUpdated;
                } else if (Array.isArray(fileContent)) {
                    // Fallback jika data disimpan langsung sebagai array
                    gwscannerData = fileContent;
                } else {
                    console.warn('GWScanner data is not in expected format, using empty array instead');
                }
            }
        } catch (err) {
            console.error('Error reading GWScanner data:', err);
        }
        
        try {
            if (fs.existsSync(ffbworkerPath)) {
                const fileContent = JSON.parse(fs.readFileSync(ffbworkerPath, 'utf8'));
                // Ambil data dari properti data jika ada
                if (fileContent && fileContent.data && Array.isArray(fileContent.data)) {
                    ffbworkerData = fileContent.data;
                    if (!lastUpdated) lastUpdated = fileContent.lastUpdated;
                } else if (Array.isArray(fileContent)) {
                    // Fallback jika data disimpan langsung sebagai array
                    ffbworkerData = fileContent;
                } else {
                    console.warn('FFB Worker data is not in expected format, using empty array instead');
                }
            }
        } catch (err) {
            console.error('Error reading FFB Worker data:', err);
        }
        
        console.log('API data request with data:');
        console.log(`- Tunjangan beras: ${tunjanganData.length} records`);
        console.log(`- BPJS: ${bpjsData.length} records`);
        console.log(`- GWScanner: ${gwscannerData.length} records`);
        console.log(`- FFB Worker: ${ffbworkerData.length} records`);
        
        res.json({
            success: true,
            dataReady: dataInitialized,
            lastCheck: lastUpdated || formatDateTime(monitoringState.lastCheck),
            data: tunjanganData,
            bpjsData: bpjsData,
            gwscannerData: gwscannerData,
            ffbworkerData: ffbworkerData
        });
    } catch (error) {
        console.error('Error getting data:', error);
        res.status(500).json({
            success: false,
            error: 'Terjadi kesalahan saat memuat data'
        });
    }
});

// Tambahkan endpoint untuk refresh data
app.get('/api/refresh-data', async (req, res) => {
    try {
        const dataType = req.query.type;
        let data = [];
        
        console.log(`Refreshing data for type: ${dataType}`);
        
        if (dataType === 'tunjangan_beras') {
            data = await dataModule.getTunjanganBerasData();
        } else if (dataType === 'bpjs') {
            data = await dataModule.getBPJSData();
        } else if (dataType === 'gwscanner') {
            data = await dataModule.getGWScannerData();
        } else if (dataType === 'ffbworker') {
            data = await dataModule.getFFBWorkerData();
        } else if (dataType === 'all') {
            // Refresh semua data
            const tunjanganData = await dataModule.getTunjanganBerasData();
            const bpjsData = await dataModule.getBPJSData();
            const gwscannerData = await dataModule.getGWScannerData();
            const ffbworkerData = await dataModule.getFFBWorkerData();
            
            data = {
                tunjangan_beras: tunjanganData.length,
                bpjs: bpjsData.length,
                gwscanner: gwscannerData.length,
                ffbworker: ffbworkerData.length
            };
        } else {
            return res.status(400).json({
                success: false,
                error: 'Tipe data tidak valid'
            });
        }
        
        // Update waktu pemeriksaan terakhir
        monitoringState.lastCheck = new Date();
        
        res.json({
            success: true,
            message: `Data ${dataType} berhasil diperbarui`,
            recordCount: Array.isArray(data) ? data.length : data,
            timestamp: formatDateTime(new Date())
        });
    } catch (error) {
        console.error('Error refreshing data:', error);
        res.status(500).json({
            success: false,
            error: 'Terjadi kesalahan saat memperbarui data'
        });
    }
});

// Tambahkan endpoint untuk memeriksa status data
app.get('/api/check-data-status', (req, res) => {
    try {
        const status = checkDataStatus();
        res.json({
            success: true,
            allDataReady: dataInitialized,
            dataStatus: status.dataStatus
        });
    } catch (error) {
        console.error('Error checking data status:', error);
        res.status(500).json({
            success: false,
            error: 'Terjadi kesalahan saat memeriksa status data'
        });
    }
});

// Tambahkan route untuk menjalankan query
app.post('/run-query', authMiddleware, async (req, res) => {
    try {
        const { queryType } = req.body;
        
        if (!queryType) {
            return res.status(400).json({
                success: false,
                error: 'Query type is required'
            });
        }
        
        console.log(`Running query for ${queryType}...`);
        
        let result;
        
        // Jalankan query berdasarkan jenis
        switch (queryType) {
            case 'tunjangan_beras':
                result = await checkTunjanganBerasData();
                break;
            case 'bpjs':
                result = await checkBpjsData();
                break;
            case 'gwscanner':
                result = await checkGwScannerData();
                break;
            case 'ffbworker':
                result = await checkFfbWorkerData();
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: `Unknown query type: ${queryType}`
                });
        }
        
        return res.json({
            success: true,
            message: `Query for ${queryType} executed successfully`,
            data: result,
            lastCheck: formatDateTime(monitoringState.lastCheck)
        });
    } catch (err) {
        console.error('Error running query:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Error running query'
        });
    }
});

// Tambahkan endpoint untuk menyimpan konfigurasi email
app.post('/api/email-config', authMiddleware, (req, res) => {
    try {
        // Update email config
        if (req.body['sender.email']) {
            emailConfig.senderEmail = req.body['sender.email'];
        }
        
        if (req.body['sender.password'] && req.body['sender.password'].trim() !== '') {
            // Hanya update password jika diisi
            appConfig.email.sender.password = req.body['sender.password'];
        }
        
        if (req.body['recipients.firstTime']) {
            emailConfig.firstTimeEmail = req.body['recipients.firstTime'];
            appConfig.email.recipients.firstTime = req.body['recipients.firstTime'];
        }
        
        if (req.body['recipients.interval']) {
            emailConfig.receiverEmail = req.body['recipients.interval'];
            appConfig.email.recipients.interval = req.body['recipients.interval'];
        }
        
        if (req.body['cc']) {
            emailConfig.ccEmail = req.body['cc'];
            appConfig.email.cc = req.body['cc'].split(',').map(email => email.trim());
        }
        
        if (req.body['interval.checkData']) {
            const checkInterval = parseInt(req.body['interval.checkData']);
            if (!isNaN(checkInterval) && checkInterval > 0) {
                emailConfig.scheduleInterval = checkInterval;
                appConfig.email.interval.checkData = checkInterval;
                
                // Update schedule
                updateSchedule(checkInterval);
            }
        }
        
        if (req.body['interval.sendEmail']) {
            const emailInterval = parseInt(req.body['interval.sendEmail']);
            if (!isNaN(emailInterval) && emailInterval > 0) {
                emailConfig.emailInterval = emailInterval;
                appConfig.email.interval.sendEmail = emailInterval;
            }
        }
        
        // Update email enabled status
        emailConfig.isEnabled = req.body['isEnabled'] === 'on';
        appConfig.email.isEnabled = emailConfig.isEnabled;
        
        // Simpan konfigurasi ke file
        fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(appConfig, null, 2));
        
        res.json({
            success: true,
            message: 'Konfigurasi email berhasil disimpan'
        });
    } catch (error) {
        console.error('Error saving email config:', error);
        res.status(500).json({
            success: false,
            error: 'Terjadi kesalahan saat menyimpan konfigurasi email'
        });
    }
});

// Tambahkan endpoint untuk mengirim email test
app.post('/api/send-test-email', authMiddleware, async (req, res) => {
    try {
        // Buat transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailConfig.senderEmail,
                pass: appConfig.email?.sender?.password || "fxjioeubpjfruasy"
            }
        });
        
        // Buat email options
        const mailOptions = {
            from: emailConfig.senderEmail,
            to: emailConfig.receiverEmail,
            cc: emailConfig.ccEmail,
            subject: 'Test Email dari Aplikasi Monitoring Database',
            html: `
                <h2>Test Email</h2>
                <p>Ini adalah email test dari aplikasi Monitoring Database.</p>
                <p>Jika Anda menerima email ini, berarti konfigurasi email sudah benar.</p>
                <p>Waktu pengiriman: ${formatDateTime(new Date())}</p>
            `
        };
        
        // Kirim email
        await transporter.sendMail(mailOptions);
        
        res.json({
            success: true,
            message: 'Email test berhasil dikirim'
        });
    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).json({
            success: false,
            error: `Terjadi kesalahan saat mengirim email test: ${error.message}`
        });
    }
});

// Fungsi untuk memeriksa data tunjangan beras
async function checkTunjanganBerasData() {
    try {
        console.log('Checking tunjangan beras data...');
        
        // Buat koneksi ke database
        const pool = await getPool();
        
        // Jalankan query asli
        console.log('Executing tunjangan beras query...');
        const result = await pool.request().query(getTunjanganBerasQuery);
        console.log(`Query completed. Found ${result.recordset.length} records.`);
        
        // Pastikan SalGradeCode tidak null atau undefined
        const processedResults = result.recordset.map(item => {
            // Pastikan SalGradeCode selalu string kosong jika null atau undefined
            if (!item.SalGradeCode) {
                item.SalGradeCode = '';
            }
            return item;
        });
        
        monitoringState.lastCheck = new Date();
        monitoringState.previousData = monitoringState.currentData;
        monitoringState.currentData = processedResults;
        
        // Simpan data ke history
        saveQueryHistory('tunjangan_beras', processedResults);
        
        // Simpan hasil query ke file JSON untuk tampilan
        saveQueryResultsToJson('tunjangan_beras', processedResults);
        
        // Simpan ke temporary file
        saveTempData('tunjangan_beras', processedResults);
        
        return processedResults;
    } catch (err) {
        console.error('Error checking tunjangan beras data:', err);
        // If we get a timeout error, try to close and recreate the pool
        if (err.code === 'ETIMEOUT') {
            console.log('Timeout occurred, attempting to reset connection pool...');
            if (pool) {
                try {
                    await pool.close();
                } catch (closeErr) {
                    console.error('Error closing pool:', closeErr);
                }
            }
            pool = null;
        }
        
        // Jika terjadi error, gunakan data dari file temporary jika ada
        const tempData = loadTempData('tunjangan_beras');
        if (tempData && tempData.data.length > 0) {
            console.log(`Using temporary data for tunjangan_beras (${tempData.data.length} records)`);
            return tempData.data;
        }
        
        throw err;
    }
}

// Modifikasi fungsi checkBpjsData untuk menyimpan ke temporary file
async function checkBpjsData() {
    try {
        console.log('Executing BPJS query...');
        const pool = await getPool();
        const result = await pool.request().query(getBpjsQuery);
        
        console.log(`BPJS query completed. Found ${result.recordset.length} records.`);
        
        monitoringState.bpjsData = result.recordset;
        
        // Simpan data ke history
        saveQueryHistory('bpjs', result.recordset);
        
        // Simpan hasil query ke file JSON untuk tampilan
        saveQueryResultsToJson('bpjs', result.recordset);
        
        // Simpan ke temporary file
        saveTempData('bpjs', result.recordset);
        
        return result.recordset;
    } catch (err) {
        console.error('Error checking BPJS data:', err);
        
        // Jika terjadi error, gunakan data dari file temporary jika ada
        const tempData = loadTempData('bpjs');
        if (tempData && tempData.data.length > 0) {
            console.log(`Using temporary data for bpjs (${tempData.data.length} records)`);
            return tempData.data;
        }
        
        throw err;
    }
}

// Modifikasi fungsi checkGwScannerData untuk menyimpan ke temporary file
async function checkGwScannerData() {
    try {
        console.log('Executing GWScanner duplicate check query...');
        const pool = await getPool();
        const result = await pool.request().query(getGwScannerQuery);
        
        console.log(`GWScanner query completed. Found ${result.recordset.length} duplicate records.`);
        
        monitoringState.gwscannerData = result.recordset;
        
        // Simpan data ke history
        saveQueryHistory('gwscanner', result.recordset);
        
        // Simpan hasil query ke file JSON untuk tampilan
        saveQueryResultsToJson('gwscanner', result.recordset);
        
        // Simpan ke temporary file
        saveTempData('gwscanner', result.recordset);
        
        return result.recordset;
    } catch (err) {
        console.error('Error checking GWScanner data:', err);
        
        // Jika terjadi error, gunakan data dari file temporary jika ada
        const tempData = loadTempData('gwscanner');
        if (tempData && tempData.data.length > 0) {
            console.log(`Using temporary data for gwscanner (${tempData.data.length} records)`);
            return tempData.data;
        }
        
        throw err;
    }
}

// Modifikasi fungsi checkFfbWorkerData untuk menyimpan ke temporary file
async function checkFfbWorkerData() {
    try {
        console.log('Executing FFB Worker (non-pemanen dengan Ripe) query...');
        const pool = await getPool();
        const result = await pool.request().query(getFfbWorkerQuery);
        
        console.log(`FFB Worker query completed. Found ${result.recordset.length} records.`);
        
        monitoringState.ffbworkerData = result.recordset;
        
        // Simpan data ke history
        saveQueryHistory('ffbworker', result.recordset);
        
        // Simpan hasil query ke file JSON untuk tampilan
        saveQueryResultsToJson('ffbworker', result.recordset);
        
        // Simpan ke temporary file
        saveTempData('ffbworker', result.recordset);
        
        return result.recordset;
    } catch (err) {
        console.error('Error checking FFB Worker data:', err);
        
        // Jika terjadi error, gunakan data dari file temporary jika ada
        const tempData = loadTempData('ffbworker');
        if (tempData && tempData.data.length > 0) {
            console.log(`Using temporary data for ffbworker (${tempData.data.length} records)`);
            return tempData.data;
        }
        
        throw err;
    }
}

// Modifikasi route utama untuk menggunakan data dari temporary file
app.get('/', async (req, res) => {
    try {
        // Load data dari temporary file
        const tunjanganData = loadTempData('tunjangan_beras');
        const bpjsData = loadTempData('bpjs');
        const gwscannerData = loadTempData('gwscanner');
        const ffbworkerData = loadTempData('ffbworker');
        
        console.log('Rendering index page with data:');
        console.log(`- Tunjangan beras: ${tunjanganData && tunjanganData.data ? tunjanganData.data.length : 0} records`);
        console.log(`- BPJS: ${bpjsData && bpjsData.data ? bpjsData.data.length : 0} records`);
        console.log(`- GWScanner: ${gwscannerData && gwscannerData.data ? gwscannerData.data.length : 0} records`);
        console.log(`- FFB Worker: ${ffbworkerData && ffbworkerData.data ? ffbworkerData.data.length : 0} records`);
        
        res.render('index', { 
            data: tunjanganData && tunjanganData.data ? tunjanganData.data : [],
            bpjsData: bpjsData && bpjsData.data ? bpjsData.data : [],
            gwscannerData: gwscannerData && gwscannerData.data ? gwscannerData.data : [],
            ffbworkerData: ffbworkerData && ffbworkerData.data ? ffbworkerData.data : [],
            lastCheck: formatDateTime(monitoringState.lastCheck),
            lastEmail: formatDateTime(monitoringState.lastEmail),
            isActive: monitoringState.isActive,
            dataReady: dataInitialized,
            emailConfig
        });
    } catch (error) {
        console.error('Error rendering index page:', error);
        res.status(500).render('index', { 
            error: 'Terjadi kesalahan saat memuat data. Silakan coba lagi nanti.',
            data: [],
            bpjsData: [],
            gwscannerData: [],
            ffbworkerData: [],
            lastCheck: 'Error',
            lastEmail: 'Error',
            isActive: false,
            dataReady: false,
            emailConfig
        });
    }
});

// Fungsi untuk inisialisasi data
async function initializeData() {
    try {
        console.log('Initializing data...');
        
        // Jalankan semua query dan simpan ke temporary file
        const tunjanganData = await checkTunjanganBerasData();
        saveTempData('tunjangan_beras', tunjanganData);
        console.log('Tunjangan beras data saved to temporary file');
        
        const bpjsData = await checkBpjsData();
        saveTempData('bpjs', bpjsData);
        console.log('BPJS data saved to temporary file');
        
        const gwscannerData = await checkGwScannerData();
        saveTempData('gwscanner', gwscannerData);
        console.log('GWScanner data saved to temporary file');
        
        const ffbworkerData = await checkFfbWorkerData();
        saveTempData('ffbworker', ffbworkerData);
        console.log('FFB Worker data saved to temporary file');
        
        // Set flag bahwa data sudah diinisialisasi
        dataInitialized = true;
        
        console.log('All data initialized and saved to temporary files');
        console.log('Server is now ready to serve requests');
        
        return true;
    } catch (error) {
        console.error('Error initializing data:', error);
        return false;
    }
}

// Modifikasi fungsi updateSchedule untuk mengubah interval menjadi 1 jam
function updateSchedule(intervalMinutes = 60) {
    // Clear existing schedules
    if (monitoringState.schedules.checkData) {
        clearInterval(monitoringState.schedules.checkData);
    }
    
    // Set new schedule for checking data (default: 60 minutes = 1 hour)
    monitoringState.schedules.checkData = setInterval(async () => {
        try {
            console.log(`Running scheduled check at ${new Date().toISOString()}`);
            await checkDataAndNotify();
            console.log(`Scheduled check completed at ${formatDateTime(new Date())}`);
        } catch (err) {
            console.error('Error in scheduled check:', err);
        }
    }, intervalMinutes * 60 * 1000);
    
    // Gunakan nilai default jika emailConfig.interval.sendEmail tidak ada
    const emailIntervalMinutes = (emailConfig && emailConfig.interval && emailConfig.interval.sendEmail) ? 
        emailConfig.interval.sendEmail : 180;
    
    console.log(`Setting up new schedules: check every ${intervalMinutes} minutes, email every ${emailIntervalMinutes} minutes`);
}

// Modifikasi app.listen untuk menginisialisasi data terlebih dahulu
// Ganti kode app.listen yang ada dengan kode berikut:
async function startServer() {
    try {
        // Inisialisasi data terlebih dahulu
        console.log('Preparing data before starting server...');
        await initializeData();
        
        // Set interval untuk refresh data otomatis setiap 1 jam
        updateSchedule(60); // 60 menit = 1 jam
        
        // Start server
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
            console.log('Data is ready. You can now access the monitoring interface.');
            console.log(`Open http://localhost:${port} in your browser to access the monitoring interface`);
        });
    } catch (error) {
        console.error('Error starting server:', error);
    }
}

// Fungsi untuk menjalankan semua query dan mengirim notifikasi jika diperlukan
async function checkDataAndNotify() {
    try {
        console.log('Running all queries...');
        
        // Jalankan semua query
        const tunjanganData = await checkTunjanganBerasData();
        saveTempData('tunjangan_beras', tunjanganData);
        
        const bpjsData = await checkBpjsData();
        saveTempData('bpjs', bpjsData);
        
        const gwscannerData = await checkGwScannerData();
        saveTempData('gwscanner', gwscannerData);
        
        const ffbworkerData = await checkFfbWorkerData();
        saveTempData('ffbworker', ffbworkerData);
        
        // Set flag bahwa data sudah diinisialisasi
        dataInitialized = true;
        
        console.log('All queries completed successfully');
        
        return {
            tunjanganData,
            bpjsData,
            gwscannerData,
            ffbworkerData
        };
    } catch (error) {
        console.error('Error running queries:', error);
        throw error;
    }
}

// Endpoint untuk mendapatkan data history
app.get('/api/history', (req, res) => {
    try {
        const historyData = loadHistoryData();
        res.json({ success: true, data: historyData });
    } catch (error) {
        console.error('Error loading history data:', error);
        res.status(500).json({ success: false, error: 'Gagal memuat data history' });
    }
});

// Fungsi untuk memuat data history
function loadHistoryData() {
    const historyDir = path.join(__dirname, 'history');
    const historyFiles = fs.readdirSync(historyDir);
    
    const historyData = {
        tunjangan_beras: [],
        bpjs: [],
        gwscanner: [],
        ffbworker: []
    };
    
    historyFiles.forEach(file => {
        // Skip unified_history.json dan file yang bukan .json
        if (!file.endsWith('.json') || file === 'unified_history.json') {
            return;
        }
        
        try {
            const filePath = path.join(historyDir, file);
            const stats = fs.statSync(filePath);
            const fileSize = (stats.size / 1024).toFixed(2) + ' KB';
            
            // Pastikan format file sesuai dengan yang diharapkan
            const parts = file.split('_');
            if (parts.length < 2) {
                console.warn(`Skipping file with invalid format: ${file}`);
                return;
            }
            
            // Baca dan parse file JSON
            const fileContent = fs.readFileSync(filePath, 'utf8');
            let data;
            
            try {
                data = JSON.parse(fileContent);
            } catch (e) {
                console.error(`Error parsing JSON from ${file}:`, e);
                return;
            }
            
            // Ekstrak timestamp dari nama file atau gunakan waktu modifikasi file
            let timestamp;
            if (parts.length >= 3 && parts[1] && parts[2]) {
                // Format: type_date_time.json
                const dateTimePart = parts[1] + '_' + parts[2].replace('.json', '');
                timestamp = dateTimePart;
            } else {
                // Gunakan waktu modifikasi file sebagai fallback
                timestamp = moment(stats.mtime).format('YYYY-MM-DD_HH-mm-ss');
            }
            
            const type = parts[0];
            const count = data.data ? data.data.length : (data.recordCount || 0);
            
            // Tambahkan data ke kategori yang sesuai
            if (type === 'tunjangan' || type === 'tunjangan_beras') {
                historyData.tunjangan_beras.push({
                    timestamp,
                    file,
                    size: fileSize,
                    count
                });
            } else if (type === 'bpjs') {
                historyData.bpjs.push({
                    timestamp,
                    file,
                    size: fileSize,
                    count
                });
            } else if (type === 'gwscanner') {
                historyData.gwscanner.push({
                    timestamp,
                    file,
                    size: fileSize,
                    count
                });
            } else if (type === 'ffbworker') {
                historyData.ffbworker.push({
                    timestamp,
                    file,
                    size: fileSize,
                    count
                });
            }
        } catch (error) {
            console.error(`Error processing file ${file}:`, error);
        }
    });
    
    // Sort by timestamp (newest first)
    Object.keys(historyData).forEach(key => {
        historyData[key].sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
    });
    
    return historyData;
}

// Endpoint untuk mendapatkan data history tertentu
app.get('/api/history-data', (req, res) => {
    try {
        const { file } = req.query;
        
        // Jika file tidak diberikan, kembalikan semua data history
        if (!file) {
            const historyData = loadHistoryData();
            return res.json({ success: true, data: historyData });
        }
        
        const filePath = path.join(__dirname, 'history', file);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'File tidak ditemukan' });
        }
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let data;
        
        try {
            data = JSON.parse(fileContent);
        } catch (err) {
            return res.status(500).json({ success: false, error: 'Format file tidak valid' });
        }
        
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error getting history data:', error);
        res.status(500).json({ success: false, error: 'Gagal memuat data history' });
    }
});

// Endpoint untuk mendapatkan konfigurasi email
app.get('/api/config/email', (req, res) => {
    try {
        const configPath = path.join(__dirname, 'config.json');
        let config = {};
        
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            config = JSON.parse(configData);
        }
        
        // Hapus password dari respons untuk keamanan
        if (config.sender && config.sender.password) {
            config.sender.password = '********';
        }
        
        res.json({ success: true, config });
    } catch (error) {
        console.error('Error loading email config:', error);
        res.status(500).json({ success: false, error: 'Gagal memuat konfigurasi email' });
    }
});

// Endpoint untuk menyimpan konfigurasi email
app.post('/api/config/email', (req, res) => {
    try {
        const configPath = path.join(__dirname, 'config.json');
        let config = {};
        
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            config = JSON.parse(configData);
        }
        
        // Update konfigurasi dengan data baru
        const newConfig = req.body;
        
        // Jika password kosong, gunakan password yang ada
        if (newConfig.sender && newConfig.sender.password === '') {
            if (config.sender && config.sender.password) {
                newConfig.sender.password = config.sender.password;
            }
        }
        
        // Simpan konfigurasi baru
        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
        
        // Hapus password dari respons untuk keamanan
        if (newConfig.sender && newConfig.sender.password) {
            newConfig.sender.password = '********';
        }
        
        res.json({ success: true, config: newConfig });
    } catch (error) {
        console.error('Error saving email config:', error);
        res.status(500).json({ success: false, error: 'Gagal menyimpan konfigurasi email' });
    }
});

// Endpoint untuk toggle status email
app.post('/api/config/email/toggle', (req, res) => {
    try {
        // Baca konfigurasi saat ini
        const configPath = path.join(__dirname, 'config.json');
        let config = {};
        
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            config = JSON.parse(configData);
        }
        
        // Toggle status email
        config.email.isEnabled = !config.email.isEnabled;
        emailConfig.isEnabled = config.email.isEnabled;
        
        // Simpan konfigurasi baru
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        
        res.json({ 
            success: true, 
            isEnabled: config.email.isEnabled,
            message: config.email.isEnabled ? 'Notifikasi email diaktifkan' : 'Notifikasi email dinonaktifkan'
        });
    } catch (error) {
        console.error('Error toggling email status:', error);
        res.status(500).json({ success: false, error: 'Gagal mengubah status email' });
    }
});

// Endpoint untuk reset konfigurasi email ke default
app.post('/api/reset-email-config', authMiddleware, (req, res) => {
    try {
        // Reset ke konfigurasi default
        const defaultEmailConfig = {
            sender: {
                email: "atharizki.developer@gmail.com",
                password: "fxjioeubpjfruasy"
            },
            isEnabled: false,
            interval: {
                checkData: 5,
                sendEmail: 180
            },
            recipients: {
                firstTime: "atharizki001@gmail.com",
                interval: "estate_it@rebinmas.com",
                tunjangan_beras: "hrd@rebinmas.com",
                bpjs: "hrd@rebinmas.com",
                gwscanner: "estate_it@rebinmas.com",
                ffbworker: "estate_it@rebinmas.com"
            },
            cc: []
        };
        
        // Update konfigurasi aplikasi
        appConfig.email = defaultEmailConfig;
        
        // Update variabel emailConfig
        emailConfig = {
            senderEmail: defaultEmailConfig.sender.email,
            receiverEmail: defaultEmailConfig.recipients.interval,
            firstTimeEmail: defaultEmailConfig.recipients.firstTime,
            ccEmail: defaultEmailConfig.cc.join(','),
            scheduleInterval: defaultEmailConfig.interval.checkData,
            emailInterval: defaultEmailConfig.interval.sendEmail,
            emailTemplate: appConfig.templates.tunjangan_beras,
            isFirstEmail: true,
            isEnabled: defaultEmailConfig.isEnabled,
            queryEmails: {
                tunjangan_beras: defaultEmailConfig.recipients.tunjangan_beras,
                bpjs: defaultEmailConfig.recipients.bpjs,
                gwscanner: defaultEmailConfig.recipients.gwscanner,
                ffbworker: defaultEmailConfig.recipients.ffbworker
            }
        };
        
        // Simpan konfigurasi ke file
        const configPath = path.join(__dirname, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), 'utf8');
        
        res.json({
            success: true,
            message: 'Konfigurasi email berhasil direset ke default',
            config: {
                ...defaultEmailConfig,
                sender: {
                    ...defaultEmailConfig.sender,
                    password: '********'
                }
            }
        });
    } catch (error) {
        console.error('Error resetting email config:', error);
        res.status(500).json({ success: false, error: 'Gagal mereset konfigurasi email' });
    }
});

// Endpoint untuk update kata sandi konfigurasi
app.post('/api/update-config-password', authMiddleware, (req, res) => {
    try {
        const { configPassword } = req.body;
        
        if (!configPassword || configPassword.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Kata sandi tidak boleh kosong'
            });
        }
        
        // Update konfigurasi
        appConfig.auth.passkey = configPassword;
        
        // Simpan konfigurasi ke file
        const configPath = path.join(__dirname, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), 'utf8');
        
        res.json({
            success: true,
            message: 'Kata sandi berhasil diperbarui'
        });
    } catch (error) {
        console.error('Error updating config password:', error);
        res.status(500).json({
            success: false,
            error: 'Gagal memperbarui kata sandi'
        });
    }
});

// Endpoint untuk mengirim data saat ini
app.post('/api/send-current-data', authMiddleware, async (req, res) => {
    try {
        // Periksa apakah email diaktifkan
        if (!emailConfig.isEnabled) {
            return res.status(400).json({
                success: false,
                error: 'Notifikasi email tidak diaktifkan'
            });
        }
        
        // Load data dari temporary file
        const tunjanganData = loadTempData('tunjangan_beras');
        const bpjsData = loadTempData('bpjs');
        const gwscannerData = loadTempData('gwscanner');
        const ffbworkerData = loadTempData('ffbworker');
        
        // Buat transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailConfig.senderEmail,
                pass: appConfig.email?.sender?.password || "fxjioeubpjfruasy"
            }
        });
        
        // Hitung status ItechUpdateStatus untuk GWScanner
        let itechUpdateStatusCounts = { null: 0, 'N/A': 0 };
        if (gwscannerData && gwscannerData.data) {
            gwscannerData.data.forEach(item => {
                const status = item.ItechUpdateStatus || 'N/A';
                if (!itechUpdateStatusCounts[status]) {
                    itechUpdateStatusCounts[status] = 0;
                }
                itechUpdateStatusCounts[status]++;
            });
        }
        
        // Hitung RiceRationCode untuk Tunjangan Beras
        let riceRationCodeCounts = {};
        if (tunjanganData && tunjanganData.data) {
            tunjanganData.data.forEach(item => {
                const code = item.RiceRationCode || 'Tidak Ada';
                if (!riceRationCodeCounts[code]) {
                    riceRationCodeCounts[code] = 0;
                }
                riceRationCodeCounts[code]++;
            });
        }
        
        // Buat tabel status ItechUpdateStatus
        let itechStatusTable = '<h4>Status ItechUpdateStatus GWScanner</h4><table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">';
        itechStatusTable += '<tr style="background-color: #f2f2f2;"><th>Status</th><th>Jumlah</th></tr>';
        
        for (const [status, count] of Object.entries(itechUpdateStatusCounts)) {
            itechStatusTable += `<tr><td>${status}</td><td>${count}</td></tr>`;
        }
        
        itechStatusTable += '</table>';
        
        // Buat tabel RiceRationCode
        let riceRationTable = '<h4>Distribusi RiceRationCode</h4><table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">';
        riceRationTable += '<tr style="background-color: #f2f2f2;"><th>RiceRationCode</th><th>Jumlah</th></tr>';
        
        for (const [code, count] of Object.entries(riceRationCodeCounts)) {
            riceRationTable += `<tr><td>${code}</td><td>${count}</td></tr>`;
        }
        
        riceRationTable += '</table>';
        
        // Buat tabel sampel data tunjangan beras (10 data pertama)
        let tunjanganSampleTable = '';
        if (tunjanganData && tunjanganData.data && tunjanganData.data.length > 0) {
            tunjanganSampleTable = '<h4>Sampel Data Tunjangan Beras (10 data pertama)</h4>';
            tunjanganSampleTable += '<table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">';
            tunjanganSampleTable += '<tr style="background-color: #f2f2f2;"><th>EmpCode</th><th>Nama</th><th>SalGradeCode</th><th>RiceRationCode</th><th>Rice Aktual</th><th>Rice Seharusnya</th><th>Selisih</th><th>Status</th></tr>';
            
            const sampleData = tunjanganData.data.slice(0, 10);
            sampleData.forEach(item => {
                tunjanganSampleTable += `<tr>
                    <td>${item.EmpCode || '-'}</td>
                    <td>${item.EmpName || '-'}</td>
                    <td>${item.SalGradeCode || '-'}</td>
                    <td>${item.RiceRationCode || '-'}</td>
                    <td>${item.RiceRation_Aktual || '-'}</td>
                    <td>${item.RiceRation_Seharusnya || '-'}</td>
                    <td>${item.Selisih_RiceRation || '-'}</td>
                    <td>${item.Perbandingan_RiceRation || '-'}</td>
                </tr>`;
            });
            
            tunjanganSampleTable += '</table>';
        }
        
        // Buat email options
        const mailOptions = {
            from: emailConfig.senderEmail,
            to: emailConfig.receiverEmail,
            cc: emailConfig.ccEmail,
            subject: 'Data Monitoring Database - ' + formatDateTime(new Date()),
            html: `
                <h2>Data Monitoring Database</h2>
                <p>Berikut adalah data monitoring database per ${formatDateTime(new Date())}:</p>
                
                <h3>Tunjangan Beras</h3>
                <p>Jumlah data: ${tunjanganData ? tunjanganData.data.length : 0}</p>
                ${riceRationTable}
                ${tunjanganSampleTable}
                
                <h3>BPJS</h3>
                <p>Jumlah data: ${bpjsData ? bpjsData.data.length : 0}</p>
                
                <h3>GWScanner</h3>
                <p>Jumlah data: ${gwscannerData ? gwscannerData.data.length : 0}</p>
                ${itechStatusTable}
                
                <h3>FFB Worker</h3>
                <p>Jumlah data: ${ffbworkerData ? ffbworkerData.data.length : 0}</p>
                
                <p>Silakan akses aplikasi untuk melihat detail data.</p>
            `
        };
        
        // Kirim email
        await transporter.sendMail(mailOptions);
        
        // Update waktu email terakhir
        monitoringState.lastEmail = new Date();
        
        res.json({
            success: true,
            message: 'Data berhasil dikirim'
        });
    } catch (error) {
        console.error('Error sending current data:', error);
        res.status(500).json({
            success: false,
            error: `Gagal mengirim data: ${error.message}`
        });
    }
});

// Panggil fungsi startServer
startServer();