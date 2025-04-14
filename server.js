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

// Variabel global untuk periode pembukuan
let taxMonthData = null;

// Fungsi untuk menyimpan data ke temporary file
function saveTempData(type, data) {
    try {
        // Pastikan direktori temp ada
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFile = path.join(tempDir, `${type}_temp.json`);
        const tempData = {
            timestamp: new Date().toISOString(),
            data: data
        };
        
        fs.writeFileSync(tempFile, JSON.stringify(tempData, null, 2));
        return true;
    } catch (err) {
        console.error(`Error saving temporary data for ${type}:`, err);
        return false;
    }
}

// Fungsi untuk membaca data dari temporary file
function loadTempData(type) {
    try {
        const tempFile = path.join(tempDir, `${type}_temp.json`);
        if (fs.existsSync(tempFile)) {
            // Baca file tanpa log berlebihan
            const fileContent = fs.readFileSync(tempFile, 'utf8');
            const data = JSON.parse(fileContent);
            
            // Pastikan data memiliki struktur yang benar
            if (!data.data) {
                console.warn(`Temporary data for ${type} has invalid structure, missing data property`);
                return null;
            }
            
            return data;
        }
        
        console.log(`No temporary data found for ${type}`);
        return null;
    } catch (err) {
        console.error(`Error loading temporary data for ${type}:`, err);
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

// Fungsi untuk memeriksa dan memperbarui data jika perlu
async function checkAndRefreshData(type, refreshFunction, forceRefresh = false, refreshInterval = 5) {
    const tempData = loadTempData(type);
    
    // Jika tidak ada data atau data sudah lebih dari interval yang ditentukan, perbarui data
    if (!tempData || !tempData.timestamp || forceRefresh) {
        console.log(`No data found for ${type} or force refresh requested, fetching from database...`);
        const newData = await refreshFunction();
        saveTempData(type, newData);
        return newData;
    }
    
    // Periksa timestamp data
    const lastUpdate = new Date(tempData.timestamp);
    const now = new Date();
    const diffMinutes = (now - lastUpdate) / (1000 * 60); // Perbedaan dalam menit
    
    // Jika data sudah lebih dari interval yang ditentukan, perbarui data
    if (diffMinutes > refreshInterval) {
        console.log(`Data for ${type} is older than ${refreshInterval} minutes (${Math.round(diffMinutes)} minutes old), refreshing from database...`);
        const newData = await refreshFunction();
        saveTempData(type, newData);
        return newData;
    }
    
    // Gunakan data yang sudah ada
    console.log(`Using cached data for ${type} (${Math.round(diffMinutes)} minutes old)`);
    return tempData.data;
}

// Tambahkan endpoint untuk mendapatkan data
app.get('/api/data', async (req, res) => {
    try {
        // Load data dengan pemeriksaan timestamp
        const tunjanganData = await checkAndRefreshData('tunjangan_beras', checkTunjanganBerasData);
        const bpjsData = await checkAndRefreshData('bpjs', checkBpjsData);
        const gwscannerData = await checkAndRefreshData('gwscanner', checkGwScannerData);
        const ffbworkerData = await checkAndRefreshData('ffbworker', checkFfbWorkerData);
        const gwscannerOvertimeNotSyncData = await checkAndRefreshData('gwscanner_overtime_not_sync', checkGWScannerOvertimeSyncData);
        
        console.log('API data request with data:');
        console.log(`- Tunjangan beras: ${tunjanganData ? tunjanganData.length : 0} records`);
        console.log(`- BPJS: ${bpjsData ? bpjsData.length : 0} records`);
        console.log(`- GWScanner: ${gwscannerData ? gwscannerData.length : 0} records`);
        console.log(`- FFB Worker: ${ffbworkerData ? ffbworkerData.length : 0} records`);
        console.log(`- GWScanner-Overtime Not Sync: ${gwscannerOvertimeNotSyncData ? gwscannerOvertimeNotSyncData.length : 0} records`);
        
        res.json({
            success: true,
            data: {
                tunjangan_beras: tunjanganData || [],
                bpjs: bpjsData || [],
                gwscanner: gwscannerData || [],
                ffbworker: ffbworkerData || [],
                gwscanner_overtime_not_sync: gwscannerOvertimeNotSyncData || []
            },
            lastCheck: formatDateTime(monitoringState.lastCheck),
            lastEmail: formatDateTime(monitoringState.lastEmail),
            isActive: monitoringState.isActive
        });
    } catch (error) {
        console.error('Error loading data:', error);
        res.status(500).json({
            success: false,
            error: 'Gagal memuat data'
        });
    }
});

// Tambahkan endpoint untuk refresh data
app.get('/api/refresh-data', async (req, res) => {
    try {
        const dataType = req.query.type;
        let recordCount = 0;
        
        console.log(`Refreshing data for type: ${dataType}`);
        
        if (dataType === 'tunjangan_beras') {
            const data = await checkAndRefreshData('tunjangan_beras', checkTunjanganBerasData, true);
            recordCount = data.length;
        } else if (dataType === 'bpjs') {
            const data = await checkAndRefreshData('bpjs', checkBpjsData, true);
            recordCount = data.length;
        } else if (dataType === 'gwscanner') {
            const data = await checkAndRefreshData('gwscanner', checkGwScannerData, true);
            recordCount = data.length;
        } else if (dataType === 'ffbworker') {
            const data = await checkAndRefreshData('ffbworker', checkFfbWorkerData, true);
            recordCount = data.length;
        } else if (dataType === 'gwscanner_overtime_not_sync') {
            const data = await checkAndRefreshData('gwscanner_overtime_not_sync', checkGWScannerOvertimeSyncData, true);
            recordCount = data.length;
        } else if (dataType === 'all') {
            // Refresh semua data
            const tunjanganData = await checkAndRefreshData('tunjangan_beras', checkTunjanganBerasData, true);
            const bpjsData = await checkAndRefreshData('bpjs', checkBpjsData, true);
            const gwscannerData = await checkAndRefreshData('gwscanner', checkGwScannerData, true);
            const ffbworkerData = await checkAndRefreshData('ffbworker', checkFfbWorkerData, true);
            const gwscannerOvertimeNotSyncData = await checkAndRefreshData('gwscanner_overtime_not_sync', checkGWScannerOvertimeSyncData, true);
            
            recordCount = {
                tunjangan_beras: tunjanganData.length,
                bpjs: bpjsData.length,
                gwscanner: gwscannerData.length,
                ffbworker: ffbworkerData.length,
                gwscanner_overtime_not_sync: gwscannerOvertimeNotSyncData.length
            };
            
            // Update waktu pemeriksaan terakhir
            monitoringState.lastCheck = new Date();
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
            recordCount: recordCount
        });
    } catch (error) {
        console.error('Error refreshing data:', error);
        res.status(500).json({
            success: false,
            error: 'Gagal memperbarui data'
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
            case 'gwscanner_overtime_not_sync':
                result = await checkGWScannerOvertimeSyncData();
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
        
        // Baca ulang file SQL setiap kali fungsi dipanggil
        const gwScannerQueryPath = path.join(__dirname, 'query', 'Find_Duplicate_GWScanner.sql');
        const freshGwScannerQuery = fs.readFileSync(gwScannerQueryPath, 'utf8');
        
        const pool = await getPool();
        const result = await pool.request().query(freshGwScannerQuery);
        
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

// Fungsi untuk mendapatkan data periode pembukuan dan menyimpannya sebagai variabel global
async function initTaxMonthData() {
    try {
        taxMonthData = await dataModule.getTaxMonth();
        console.log('Tax month data initialized:', taxMonthData);
        return taxMonthData;
    } catch (err) {
        console.error('Error initializing tax month data:', err);
        return null;
    }
}

// Modifikasi route utama untuk mengirim data periode pembukuan ke tampilan
app.get('/', authMiddleware, async (req, res) => {
    // Periksa status data
    const status = checkDataStatus();
    
    // Ambil data histori
    const historyData = loadAllHistoryData();
    
    res.render('index', { 
        dataStatus: status.dataStatus, 
        allDataReady: status.allDataReady,
        historyData: historyData,
        taxMonthData: taxMonthData,
        lastCheck: formatDateTime(new Date())
    });
});

// Fungsi untuk inisialisasi data
async function initializeData() {
    console.log('Initializing data...');
    
    // Pertama, inisialisasi data periode pembukuan
    await initTaxMonthData();
    
    // Periksa apakah data perlu diperbarui berdasarkan timestamp
    const shouldRefreshData = (type) => {
        const tempData = loadTempData(type);
        if (!tempData || !tempData.timestamp) {
            return true;
        }
        
        const lastUpdate = new Date(tempData.timestamp);
        const now = new Date();
        const diffMinutes = (now - lastUpdate) / (1000 * 60); // Perbedaan dalam menit
        
        return diffMinutes > 60; // Perbarui data jika sudah lebih dari 60 menit (1 jam)
    };
    
    // Jalankan semua query jika diperlukan
    if (shouldRefreshData('tunjangan_beras')) {
        console.log('Initializing tunjangan_beras data...');
        const tunjanganData = await checkTunjanganBerasData();
        saveTempData('tunjangan_beras', tunjanganData);
        console.log('Tunjangan beras data saved to temporary file');
    } else {
        console.log('Using existing tunjangan_beras data from temporary file');
    }
    
    if (shouldRefreshData('bpjs')) {
        console.log('Initializing bpjs data...');
        const bpjsData = await checkBpjsData();
        saveTempData('bpjs', bpjsData);
        console.log('BPJS data saved to temporary file');
    } else {
        console.log('Using existing bpjs data from temporary file');
    }
    
    if (shouldRefreshData('gwscanner')) {
        console.log('Initializing gwscanner data...');
        const gwscannerData = await checkGwScannerData();
        saveTempData('gwscanner', gwscannerData);
        console.log('GWScanner data saved to temporary file');
    } else {
        console.log('Using existing gwscanner data from temporary file');
    }
    
    if (shouldRefreshData('ffbworker')) {
        console.log('Initializing ffbworker data...');
        const ffbworkerData = await checkFfbWorkerData();
        saveTempData('ffbworker', ffbworkerData);
        console.log('FFB Worker data saved to temporary file');
    } else {
        console.log('Using existing ffbworker data from temporary file');
    }
    
    if (shouldRefreshData('gwscanner_overtime_not_sync')) {
        console.log('Initializing gwscanner_overtime_not_sync data...');
        const gwscannerOvertimeNotSyncData = await checkGWScannerOvertimeSyncData();
        saveTempData('gwscanner_overtime_not_sync', gwscannerOvertimeNotSyncData);
        console.log('GWScanner-Overtime not sync data saved to temporary file');
    } else {
        console.log('Using existing gwscanner_overtime_not_sync data from temporary file');
    }
    
    if (shouldRefreshData('gwscanner_taskreg')) {
        console.log('Initializing gwscanner_taskreg data...');
        const gwscannerTaskregData = await checkGWScannerTaskregData();
        saveTempData('gwscanner_taskreg', gwscannerTaskregData);
        console.log('GWScanner-TaskReg not sync data saved to temporary file');
    } else {
        console.log('Using existing gwscanner_taskreg data from temporary file');
    }
    
    // Set flag bahwa data sudah diinisialisasi
    dataInitialized = true;
    
    // Update waktu pemeriksaan terakhir
    monitoringState.lastCheck = new Date();
    
    console.log('All data initialized and ready to serve requests');
    
    return true;
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
        
        // Periksa apakah data perlu diperbarui berdasarkan timestamp
        const shouldRefreshData = (type) => {
            const tempData = loadTempData(type);
            if (!tempData || !tempData.timestamp) {
                return true;
            }
            
            const lastUpdate = new Date(tempData.timestamp);
            const now = new Date();
            const diffMinutes = (now - lastUpdate) / (1000 * 60); // Perbedaan dalam menit
            
            return diffMinutes > 60; // Perbarui data jika sudah lebih dari 60 menit (1 jam)
        };
        
        // Jalankan semua query jika diperlukan
        if (shouldRefreshData('tunjangan_beras')) {
            console.log('Refreshing tunjangan_beras data (older than 1 hour)...');
            const tunjanganData = await checkTunjanganBerasData();
            saveTempData('tunjangan_beras', tunjanganData);
        }
        
        if (shouldRefreshData('bpjs')) {
            console.log('Refreshing bpjs data (older than 1 hour)...');
            const bpjsData = await checkBpjsData();
            saveTempData('bpjs', bpjsData);
        }
        
        if (shouldRefreshData('gwscanner')) {
            console.log('Refreshing gwscanner data (older than 1 hour)...');
            const gwscannerData = await checkGwScannerData();
            saveTempData('gwscanner', gwscannerData);
        }
        
        if (shouldRefreshData('ffbworker')) {
            console.log('Refreshing ffbworker data (older than 1 hour)...');
            const ffbworkerData = await checkFfbWorkerData();
            saveTempData('ffbworker', ffbworkerData);
        }
        
        if (shouldRefreshData('gwscanner_overtime_not_sync')) {
            console.log('Refreshing gwscanner_overtime_not_sync data (older than 1 hour)...');
            const gwscannerOvertimeNotSyncData = await checkGWScannerOvertimeSyncData();
            saveTempData('gwscanner_overtime_not_sync', gwscannerOvertimeNotSyncData);
        }
        
        if (shouldRefreshData('gwscanner_taskreg')) {
            console.log('Refreshing gwscanner_taskreg data (older than 1 hour)...');
            const gwscannerTaskregData = await checkGWScannerTaskregData();
            saveTempData('gwscanner_taskreg', gwscannerTaskregData);
        }
        
        // Set flag bahwa data sudah diinisialisasi
        dataInitialized = true;
        
        // Update waktu pemeriksaan terakhir
        monitoringState.lastCheck = new Date();
        
        console.log('All queries completed successfully');
        
        // Load data dari temporary file untuk notifikasi
        const tunjanganData = loadTempData('tunjangan_beras');
        const bpjsData = loadTempData('bpjs');
        const gwscannerData = loadTempData('gwscanner');
        const ffbworkerData = loadTempData('ffbworker');
        const gwscannerOvertimeNotSyncData = loadTempData('gwscanner_overtime_not_sync');
        const gwscannerTaskregData = loadTempData('gwscanner_taskreg');
        
        return {
            tunjanganData: tunjanganData ? tunjanganData.data : [],
            bpjsData: bpjsData ? bpjsData.data : [],
            gwscannerData: gwscannerData ? gwscannerData.data : [],
            ffbworkerData: ffbworkerData ? ffbworkerData.data : [],
            gwscannerOvertimeNotSyncData: gwscannerOvertimeNotSyncData ? gwscannerOvertimeNotSyncData.data : [],
            gwscannerTaskregData: gwscannerTaskregData ? gwscannerTaskregData.data : []
        };
    } catch (error) {
        console.error('Error checking data:', error);
        return null;
    }
}

// Endpoint untuk mendapatkan data history
app.get('/api/history', (req, res) => {
    try {
        const historyData = loadAllHistoryData();
        res.json({ success: true, data: historyData });
    } catch (error) {
        console.error('Error loading history data:', error);
        res.status(500).json({ success: false, error: 'Gagal memuat data history' });
    }
});

// Fungsi untuk memuat semua data history
function loadAllHistoryData() {
    try {
        const historyData = {
            tunjangan_beras: [],
            bpjs: [],
            gwscanner: [],
            ffbworker: [],
            gwscanner_overtime_not_sync: [],
            gwscanner_taskreg: []
        };
        
        if (fs.existsSync(historyDir)) {
            const files = fs.readdirSync(historyDir);
            
            files.forEach(file => {
                if (file.endsWith('.json')) {
                    try {
                        const filePath = path.join(historyDir, file);
                        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        
                        // Ekstrak jenis data dari nama file
                        const dataType = file.split('_')[0];
                        
                        if (historyData[dataType]) {
                            historyData[dataType].push({
                                timestamp: data.timestamp,
                                recordCount: data.recordCount,
                                filePath: filePath,
                                fileName: file
                            });
                        }
                    } catch (fileErr) {
                        console.error(`Error processing history file ${file}:`, fileErr);
                    }
                }
            });
            
            // Urutkan data berdasarkan timestamp (terbaru dulu)
            Object.keys(historyData).forEach(key => {
                historyData[key].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            });
        }
        
        console.log(`Loaded history with ${Object.keys(historyData).length} categories`);
        return historyData;
    } catch (err) {
        console.error('Error loading history data:', err);
        return {};
    }
}

// Endpoint untuk mendapatkan data history tertentu
app.get('/api/history-data', (req, res) => {
    try {
        const { file } = req.query;
        
        // Jika file tidak diberikan, kembalikan semua data history
        if (!file) {
            const historyData = loadAllHistoryData();
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
            config.sender = { ...config.sender, password: '********' };
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
            newConfig.sender = { ...newConfig.sender, password: '********' };
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

// Fungsi untuk mengecek data GWScanner-Overtime
async function checkGWScannerOvertimeSyncData() {
    try {
        console.log('Executing GWScanner-Overtime not sync query...');
        const data = await dataModule.getNotSyncGWScannerOvertimeData();
        console.log(`GWScanner-Overtime not sync query completed. Found ${data.length} records.`);
        
        // Update waktu pemeriksaan terakhir
        monitoringState.lastCheck = new Date();
        
        return data;
    } catch (err) {
        console.error('Error checking GWScanner-Overtime not sync data:', err);
        throw err;
    }
}

// Fungsi untuk mengecek data GWScanner-TaskReg
async function checkGWScannerTaskregData() {
    try {
        console.log('Executing GWScanner-TaskReg not sync query...');
        const data = await dataModule.getNotSyncGWScannerTaskregData();
        console.log(`GWScanner-TaskReg not sync query completed. Found ${data.length} records.`);
        
        // Update waktu pemeriksaan terakhir
        monitoringState.lastCheck = new Date();
        
        return data;
    } catch (err) {
        console.error('Error checking GWScanner-TaskReg not sync data:', err);
        throw err;
    }
}

// Tambahkan endpoint untuk mendapatkan konfigurasi
app.get('/api/config', (req, res) => {
    try {
        // Baca file konfigurasi
        const configPath = path.join(__dirname, 'config.json');
        const configData = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
        
        // Hapus informasi sensitif seperti password
        if (configData.sender && configData.sender.password) {
            configData.sender = { ...configData.sender, password: '********' };
        }
        
        res.json(configData);
    } catch (error) {
        console.error('Error getting configuration:', error);
        res.status(500).json({ success: false, error: 'Failed to get configuration' });
    }
});

// Tambahkan endpoint untuk memperbarui konfigurasi
app.post('/api/config', (req, res) => {
    try {
        const configPath = path.join(__dirname, 'config.json');
        const currentConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
        
        // Ambil data dari request body
        const { interval } = req.body;
        
        // Update hanya bagian interval jika ada
        if (interval) {
            currentConfig.interval = { ...currentConfig.interval, ...interval };
        }
        
        // Simpan konfigurasi yang diperbarui
        fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
        
        // Restart monitoring dengan interval baru jika perlu
        if (interval && interval.checkData) {
            // Hentikan interval yang sedang berjalan
            if (monitoringInterval) {
                clearInterval(monitoringInterval);
            }
            
            // Mulai interval baru
            const checkInterval = parseInt(interval.checkData);
            monitoringInterval = setInterval(checkData, checkInterval * 60 * 1000);
            console.log(`Monitoring interval updated to ${checkInterval} minutes`);
        }
        
        res.json({ success: true, message: 'Configuration updated successfully' });
    } catch (error) {
        console.error('Error updating configuration:', error);
        res.status(500).json({ success: false, error: 'Failed to update configuration' });
    }
});

// Endpoint untuk refresh data GWScanner
app.get('/api/refresh/gwscanner', async (req, res) => {
    try {
        console.log('Manual refresh of GWScanner data requested');
        const gwscannerData = await checkGwScannerData();
        console.log(`GWScanner data refreshed. Found ${gwscannerData.length} records.`);
        
        monitoringState.lastCheck = new Date();
        
        res.json({
            success: true,
            message: 'Data GWScanner berhasil diperbarui',
            count: gwscannerData.length,
            lastUpdated: formatDateTime(monitoringState.lastCheck)
        });
    } catch (error) {
        console.error('Error refreshing GWScanner data:', error);
        res.status(500).json({
            success: false,
            error: `Gagal memperbarui data GWScanner: ${error.message}`
        });
    }
});

// Tambahkan route untuk mengakses file-file di folder temp
app.get('/temp/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'temp', filename);
  
  console.log(`Akses ke file temp: ${filename}`);
  
  // Periksa apakah file ada
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: `File ${filename} tidak ditemukan` });
  }
});

// Tambahkan route untuk mendapatkan data periode pembukuan
app.get('/api/tax-month-data', (req, res) => {
    res.json({
        success: true,
        data: taxMonthData || {}
    });
});

// Panggil fungsi startServer
startServer();