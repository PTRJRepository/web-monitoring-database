require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const schedule = require('node-schedule');
const nodemailer = require('nodemailer');
const path = require('path');
const moment = require('moment');
const fs = require('fs');

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
    senderEmail: 'atharizki.developer@gmail.com',
    receiverEmail: 'hrd@rebinmas.com',
    firstTimeEmail: 'atharizki001@gmail.com',
    ccEmail: '',
    scheduleInterval: 5, // Check every 5 minutes
    emailInterval: 180, // Send email every 3 hours (180 minutes)
    emailTemplate: 'Ditemukan ketidaksesuaian pada data tunjangan beras karyawan. Mohon untuk segera ditindaklanjuti.',
    isFirstEmail: true, // Flag untuk email pertama
    // Email untuk setiap jenis query
    queryEmails: {
        tunjangan_beras: 'hrd@rebinmas.com',
        bpjs: 'bpjs@rebinmas.com',
        gwscanner: 'it@rebinmas.com',
        ffbworker: 'estate@rebinmas.com'
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
    ffbworkerData: []
};

// Function to save query history to file
function saveQueryHistory(dataType, data) {
    try {
        // Gunakan nama file tetap untuk setiap tipe data
        const filename = `${dataType}_history.json`;
        const filePath = path.join(historyDir, filename);
        
        // Timestamp untuk data history saat ini
        const currentTimestamp = new Date().toISOString();
        
        // Prepare data baru yang akan disimpan
        const newHistoryEntry = {
            timestamp: currentTimestamp,
            recordCount: data.length
        };
        
        // Cek apakah file history sudah ada
        let historyData = [];
        if (fs.existsSync(filePath)) {
            try {
                // Baca data history yang sudah ada
                const existingData = fs.readFileSync(filePath, 'utf8');
                historyData = JSON.parse(existingData);
                
                // Pastikan format data adalah array
                if (!Array.isArray(historyData)) {
                    historyData = [];
                }
            } catch (readErr) {
                console.error(`Error reading existing history file: ${readErr}`);
                historyData = [];
            }
        }
        
        // Tambahkan data baru ke history
        historyData.push(newHistoryEntry);
        
        // Batasi jumlah history (simpan 100 entry terakhir)
        if (historyData.length > 100) {
            historyData = historyData.slice(-100);
        }
        
        // Simpan data lengkap dalam file terpisah untuk referensi
        const detailFilePath = path.join(historyDir, `${dataType}_latest.json`);
        const detailData = {
            timestamp: currentTimestamp,
            recordCount: data.length,
            data: data
        };
        
        // Tulis file history dengan data ringkasan saja (untuk timeline)
        fs.writeFileSync(filePath, JSON.stringify(historyData, null, 2));
        console.log(`Query history updated in ${filePath}`);
        
        // Tulis file detail dengan data lengkap
        fs.writeFileSync(detailFilePath, JSON.stringify(detailData, null, 2));
        console.log(`Latest query details saved to ${detailFilePath}`);
        
        // Hapus file history yang lebih dari 30 hari
        cleanupOldHistoryFiles();
    } catch (err) {
        console.error('Error saving query history:', err);
    }
}

// Function to cleanup old history files (older than 30 days)
function cleanupOldHistoryFiles() {
    try {
        const files = fs.readdirSync(historyDir);
        const now = moment();
        
        files.forEach(file => {
            const filePath = path.join(historyDir, file);
            const stats = fs.statSync(filePath);
            const fileDate = moment(stats.mtime);
            const daysDiff = now.diff(fileDate, 'days');
            
            if (daysDiff > 30) {
                fs.unlinkSync(filePath);
                console.log(`Deleted old history file: ${file}`);
            }
        });
    } catch (err) {
        console.error('Error cleaning up old history files:', err);
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

// Function to check tunjangan beras data
async function checkTunjanganBerasData() {
    try {
        console.log('Attempting to get database pool...');
        const pool = await getPool();

        console.log('Executing tunjangan beras query with BERASBHL exclusion...');
        
        // Pertama, ambil daftar EmpCode dengan RiceRationCode = 'BERASBHL'
        console.log('Fetching EmpCode with RiceRationCode = BERASBHL to exclude...');
        const excludeQuery = `
            SELECT EmpCode 
            FROM [db_ptrj].[dbo].[HR_PAYROLL]
            WHERE RiceRationCode = 'BERASBHL'
        `;
        
        try {
            const excludeResult = await pool.request().query(excludeQuery);
            const excludedEmpCodes = new Set(excludeResult.recordset.map(row => row.EmpCode));
            
            console.log(`Found ${excludedEmpCodes.size} employees with RiceRationCode = BERASBHL to exclude`);
            
            // Jalankan query asli
            console.log('Executing original tunjangan beras query...');
            const result = await pool.request().query(getTunjanganBerasQuery);
            console.log(`Query completed. Found ${result.recordset.length} records.`);
            
            // Filter hasil secara manual dengan JavaScript
            const filteredResults = result.recordset.filter(record => 
                !excludedEmpCodes.has(record.EmpCode)
            );
            
            console.log(`After filtering: ${filteredResults.length} records (excluded ${result.recordset.length - filteredResults.length} with RiceRationCode = BERASBHL)`);
            
            monitoringState.lastCheck = new Date();
            monitoringState.previousData = monitoringState.currentData;
            monitoringState.currentData = filteredResults;
            
            // Simpan data ke history dengan nama yang konsisten
            saveQueryHistory('tunjangan_beras', filteredResults);
            
            return filteredResults;
        } catch (excludeErr) {
            console.error('Error filtering by RiceRationCode:', excludeErr);
            console.log('Falling back to original query without filtering...');
            
            // Fallback ke query asli tanpa filter
            const result = await pool.request().query(getTunjanganBerasQuery);
            console.log(`Query completed. Found ${result.recordset.length} records.`);
            
            monitoringState.lastCheck = new Date();
            monitoringState.previousData = monitoringState.currentData;
            monitoringState.currentData = result.recordset;
            
            // Simpan data ke history dengan nama yang konsisten
            saveQueryHistory('tunjangan_beras', result.recordset);
            
            return result.recordset;
        }
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
        throw err;
    }
}

// Function to check BPJS data
async function checkBpjsData() {
    try {
        console.log('Attempting to get database pool...');
        const pool = await getPool();
        
        console.log('Executing BPJS query...');
        const result = await pool.request()
            .query(getBpjsQuery);
        
        console.log(`BPJS query completed. Found ${result.recordset.length} records.`);
        
        monitoringState.bpjsData = result.recordset;
        
        // Save query history
        saveQueryHistory('bpjs', result.recordset);
        
        return result.recordset;
    } catch (err) {
        console.error('Error checking BPJS data:', err);
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
        throw err;
    }
}

// Function to check GWScanner data for duplicates
async function checkGwScannerData() {
    try {
        console.log('Attempting to get database pool...');
        const pool = await getPool();
        
        console.log('Executing GWScanner duplicate check query...');
        const result = await pool.request()
            .query(getGwScannerQuery);
        
        console.log(`GWScanner query completed. Found ${result.recordset.length} duplicate records.`);
        
        monitoringState.gwscannerData = result.recordset;
        
        // Save query history
        saveQueryHistory('gwscanner', result.recordset);
        
        // If duplicates found, send email immediately
        if (result.recordset.length > 0) {
            console.log(`Found ${result.recordset.length} duplicate GWScanner records. Sending email notification...`);
            await sendEmailNotification(result.recordset, 'gwscanner');
        }
        
        return result.recordset;
    } catch (err) {
        console.error('Error checking GWScanner data:', err);
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
        throw err;
    }
}

// Function to check FFB Worker data (non-pemanen dengan Ripe)
async function checkFfbWorkerData() {
    try {
        console.log('Attempting to get database pool for FFB Worker data check...');
        const pool = await getPool();
        
        console.log('Executing FFB Worker (non-pemanen dengan Ripe) query...');
        const result = await pool.request()
            .query(getFfbWorkerQuery);
        
        console.log(`FFB Worker query completed. Found ${result.recordset.length} records.`);
        
        monitoringState.ffbworkerData = result.recordset;
        
        // Count unique divisions (FROMOCCODE)
        const divisions = new Set();
        result.recordset.forEach(record => {
            if (record.FROMOCCODE) {
                divisions.add(record.FROMOCCODE);
            }
        });
        
        // Save query history
        saveQueryHistory('ffbworker', result.recordset);
        
        // If records found, send email notification if appropriate
        if (result.recordset.length > 0) {
            const currentTime = new Date();
            const lastEmailTime = monitoringState.lastEmail;
            
            // Kirim email jika belum pernah dikirim atau terakhir dikirim lebih dari interval yang dikonfigurasi
            const shouldSendEmailNow = !lastEmailTime || 
                (currentTime - lastEmailTime) >= (emailConfig.emailInterval * 60 * 1000);
                
            if (shouldSendEmailNow) {
                console.log(`Found ${result.recordset.length} FFB Worker records with non-harvester position. Sending email notification...`);
                await sendEmailNotification(result.recordset, 'ffbworker');
            } else {
                console.log(`Found ${result.recordset.length} FFB Worker records, but email was recently sent. Skipping notification.`);
            }
        }
        
        return {
            data: result.recordset,
            divisiCount: divisions.size
        };
    } catch (err) {
        console.error('Error checking FFB Worker data:', err);
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
        throw err;
    }
}

// Function to check data and notify
async function checkDataAndNotify() {
    try {
        // Check tunjangan beras data
        const tunjanganData = await checkTunjanganBerasData();
        
        // Check BPJS data
        const bpjsData = await checkBpjsData();
        
        // Check GWScanner data
        const gwscannerData = await checkGwScannerData();
        
        // Check FFB Worker data (non-pemanen dengan Ripe)
        const ffbworkerData = await checkFfbWorkerData();
        
        return {
            tunjanganData,
            bpjsData,
            gwscannerData,
            ffbworkerData
        };
    } catch (err) {
        console.error('Error in checkDataAndNotify:', err);
        throw err;
    }
}

// Function to send email notification
async function sendEmailNotification(data, dataType = 'tunjangan_beras') {
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: emailConfig.senderEmail,
                pass: 'fxjioeubpjfruasy'
            }
        });

        // Determine email template and recipient based on data type
        let emailSubject, emailBody, emailRecipient;
        
        switch(dataType) {
            case 'bpjs':
                emailSubject = `Monitoring BPJS - ${moment().format('DD-MM-YYYY HH:mm')}`;
                emailBody = 'Ditemukan data BPJS yang belum lengkap. Mohon untuk segera ditindaklanjuti.';
                emailRecipient = emailConfig.queryEmails.bpjs;
                break;
            case 'gwscanner':
                emailSubject = `PENTING: Duplikat GWScanner Terdeteksi - ${moment().format('DD-MM-YYYY HH:mm')}`;
                emailBody = 'Ditemukan data duplikat pada GWScanner. Mohon untuk segera ditindaklanjuti.';
                emailRecipient = emailConfig.queryEmails.gwscanner;
                break;
            case 'ffbworker':
                emailSubject = `PERHATIAN: Pekerja Non-Pemanen dengan Ripe - ${moment().format('DD-MM-YYYY HH:mm')}`;
                emailBody = 'Ditemukan data pekerja dengan posisi bukan pemanen (non-HAR) yang memiliki data Ripe. Mohon untuk segera diverifikasi.';
                emailRecipient = emailConfig.queryEmails.ffbworker;
                break;
            default: // tunjangan_beras
                emailSubject = `Monitoring Tunjangan Beras - ${moment().format('DD-MM-YYYY HH:mm')}`;
                emailBody = emailConfig.emailTemplate;
                emailRecipient = emailConfig.queryEmails.tunjangan_beras;
        }

        // Generate HTML table based on data type
        let htmlTable = '';
        
        if (dataType === 'gwscanner') {
            htmlTable = `
        <table border="1" style="border-collapse: collapse; width: 100%;">
                <tr style="background-color: #f2f2f2;">
                    <th>ID</th>
                    <th>TRANSNO</th>
                    <th>FROMOCCODE</th>
                    <th>TOOCCODE</th>
                    <th>SCANNERUSERCODE</th>
                    <th>WORKERCODE</th>
                    <th>FIELDNO</th>
                    <th>JOBCODE</th>
                    <th>VEHICLENO</th>
                    <th>TRANSDATE</th>
                    <th>RECORDTAG</th>
                    <th>TRANSSTATUS</th>
                    <th>ISCONTRACT</th>
                    <th>DATECREATED</th>
                    <th>SCANOUTDATETIME</th>
                    <th>INTEGRATETIME</th>
            </tr>
            ${data.map(row => `
                <tr>
                        <td>${row.ID}</td>
                        <td>${row.TRANSNO}</td>
                        <td>${row.FROMOCCODE}</td>
                        <td>${row.TOOCCODE}</td>
                        <td>${row.SCANNERUSERCODE}</td>
                        <td>${row.WORKERCODE}</td>
                        <td>${row.FIELDNO}</td>
                        <td>${row.JOBCODE}</td>
                        <td>${row.VEHICLENO}</td>
                        <td>${row.TRANSDATE ? moment(row.TRANSDATE).format('YYYY-MM-DD') : '-'}</td>
                        <td>${row.RECORDTAG}</td>
                        <td>${row.TRANSSTATUS}</td>
                        <td>${row.ISCONTRACT}</td>
                        <td>${row.DATECREATED ? moment(row.DATECREATED).format('YYYY-MM-DD HH:mm:ss') : '-'}</td>
                        <td>${row.SCANOUTDATETIME ? moment(row.SCANOUTDATETIME).format('YYYY-MM-DD HH:mm:ss') : '-'}</td>
                        <td>${row.INTEGRATETIME ? moment(row.INTEGRATETIME).format('YYYY-MM-DD HH:mm:ss') : '-'}</td>
                    </tr>
                `).join('')}
            </table>
            `;
        } else if (dataType === 'ffbworker') {
            htmlTable = `
            <table border="1" style="border-collapse: collapse; width: 100%;">
                <tr style="background-color: #f2f2f2;">
                    <th>ID</th>
                    <th>TRANSNO</th>
                    <th>FROMOCCODE</th>
                    <th>TOOCCODE</th>
                    <th>WORKERCODE</th>
                    <th>FIELDNO</th>
                    <th>LOOSEFRUIT</th>
                    <th>RIPE</th>
                    <th>UNRIPE</th>
                    <th>OVERRIPE</th>
                    <th>TRANSDATE</th>
                    <th>TRANSSTATUS</th>
                    <th>Status Karyawan</th>
                    <th>Posisi</th>
                    <th>Jumlah Kemunculan</th>
                </tr>
                ${data.map(row => `
                    <tr>
                        <td>${row.ID}</td>
                        <td>${row.TRANSNO}</td>
                        <td>${row.FROMOCCODE}</td>
                        <td>${row.TOOCCODE}</td>
                        <td>${row.WORKERCODE}</td>
                        <td>${row.FIELDNO}</td>
                        <td>${row.LOOSEFRUIT}</td>
                        <td>${row.RIPE}</td>
                        <td>${row.UNRIPE}</td>
                        <td>${row.OVERRIPE}</td>
                        <td>${row.TRANSDATE ? moment(row.TRANSDATE).format('YYYY-MM-DD') : '-'}</td>
                        <td>${row.TRANSSTATUS}</td>
                        <td>${row.EmployeeStatus}</td>
                        <td>${row.PosCode}</td>
                        <td>${row.JumlahKemunculan}</td>
                </tr>
            `).join('')}
        </table>
    `;
        }

        // Tentukan penerima email berdasarkan flag isFirstEmail
        const emailTo = emailConfig.isFirstEmail ? emailConfig.firstTimeEmail : emailRecipient;
        console.log(`Sending ${dataType} email to: ${emailTo} (First email: ${emailConfig.isFirstEmail})`);

    const mailOptions = {
            from: emailConfig.senderEmail,
            to: emailTo,
            subject: emailSubject,
        html: `
                <h2>${emailSubject}</h2>
                <p>${emailBody}</p>
            <p>Tanggal: ${moment().format('DD-MM-YYYY HH:mm:ss')}</p>
            <p>Jumlah Data: ${data.length}</p>
            ${htmlTable}
        `
    };

        if (emailConfig.ccEmail) {
            mailOptions.cc = emailConfig.ccEmail;
        }

    await transporter.sendMail(mailOptions);
        console.log(`${dataType} email sent successfully`);
        
        // Setelah email pertama terkirim, ubah flag
        if (emailConfig.isFirstEmail) {
            emailConfig.isFirstEmail = false;
            console.log('First email sent, switching to default recipient');
        }
        
        monitoringState.lastEmail = new Date();
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

// Main route
app.get('/', async (req, res) => {
    try {
        const result = await checkDataAndNotify();
        const formatDateTime = (date) => {
            if (!date) return 'Never';
            return moment(date).format('DD-MM-YYYY HH:mm:ss');
        };

        res.render('index', { 
            data: result.tunjanganData,
            bpjsData: result.bpjsData,
            gwscannerData: result.gwscannerData,
            ffbworkerData: result.ffbworkerData ? result.ffbworkerData.data : [],
            lastCheck: formatDateTime(monitoringState.lastCheck),
            lastEmail: formatDateTime(monitoringState.lastEmail),
            isActive: monitoringState.isActive,
            emailConfig
        });
    } catch (err) {
        console.error('Error rendering index:', err);
        res.status(500).send('Error fetching data');
    }
});

// API endpoint untuk mendapatkan data terbaru
app.get('/api/data', async (req, res) => {
    try {
        const result = await checkDataAndNotify();
        res.json({ 
            success: true, 
            data: result.tunjanganData,
            bpjsData: result.bpjsData,
            gwscannerData: result.gwscannerData,
            ffbworkerData: result.ffbworkerData ? result.ffbworkerData.data : [],
            lastCheck: monitoringState.lastCheck,
            lastEmail: monitoringState.lastEmail,
            isActive: monitoringState.isActive
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint untuk refresh data tunjangan beras
app.get('/api/refresh/tunjangan', refreshLimiter, async (req, res) => {
    try {
        const data = await checkTunjanganBerasData();
        res.json({ 
            success: true, 
            data,
            lastCheck: monitoringState.lastCheck
        });
    } catch (err) {
        console.error('Error refreshing tunjangan data:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint untuk refresh data BPJS
app.get('/api/refresh/bpjs', refreshLimiter, async (req, res) => {
    try {
        const data = await checkBpjsData();
        res.json({ 
            success: true, 
            data,
            lastCheck: monitoringState.lastCheck
        });
    } catch (err) {
        console.error('Error refreshing BPJS data:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint untuk refresh data GWScanner
app.get('/api/refresh/gwscanner', refreshLimiter, async (req, res) => {
    try {
        const data = await checkGwScannerData();
        res.json({ 
            success: true, 
            data,
            lastCheck: monitoringState.lastCheck
        });
    } catch (err) {
        console.error('Error refreshing GWScanner data:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint untuk refresh data FFB Worker
app.get('/api/refresh/ffbworker', refreshLimiter, async (req, res) => {
    try {
        const result = await checkFfbWorkerData();
        res.json({ 
            success: true, 
            data: result.data,
            divisiCount: result.divisiCount,
            lastCheck: monitoringState.lastCheck
        });
    } catch (err) {
        console.error('Error refreshing FFB Worker data:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint untuk refresh semua data
app.get('/api/refresh', refreshLimiter, async (req, res) => {
    try {
        const result = await checkDataAndNotify();
        res.json({ 
            success: true, 
            data: result.tunjanganData,
            bpjsData: result.bpjsData,
            gwscannerData: result.gwscannerData,
            ffbworkerData: result.ffbworkerData ? result.ffbworkerData.data : [],
            ffbworkerDivisiCount: result.ffbworkerData ? result.ffbworkerData.divisiCount : 0,
            lastCheck: monitoringState.lastCheck
        });
    } catch (err) {
        console.error('Error refreshing data:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint untuk mendapatkan history query
app.get('/api/history', async (req, res) => {
    try {
        const files = fs.readdirSync(historyDir);
        const historyList = files.map(file => {
            const filePath = path.join(historyDir, file);
            const stats = fs.statSync(filePath);
            return {
                filename: file,
                timestamp: stats.mtime,
                size: stats.size
            };
        }).sort((a, b) => b.timestamp - a.timestamp);
        
        res.json({ 
            success: true, 
            history: historyList
        });
    } catch (err) {
        console.error('Error getting history:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint untuk mendapatkan detail history
app.get('/api/history/:filename', async (req, res) => {
    try {
        const filePath = path.join(historyDir, req.params.filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const historyData = JSON.parse(fileContent);
        
        res.json({ 
            success: true, 
            data: historyData
        });
    } catch (err) {
        console.error('Error getting history detail:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint untuk mengirim data saat ini
app.post('/api/send-current', async (req, res) => {
    try {
        const result = await checkDataAndNotify();
        const data = req.body.dataType === 'bpjs' ? result.bpjsData : result.tunjanganData;
        
        if (data && data.length > 0) {
            await sendEmailNotification(data);
            res.json({ 
                success: true, 
                message: 'Email sent successfully',
                count: data.length
            });
        } else {
            res.json({ 
                success: false, 
                message: 'No data to send' 
            });
        }
    } catch (err) {
        console.error('Error sending current data:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint untuk menyimpan konfigurasi email
app.post('/api/config', async (req, res) => {
    try {
        console.log('Received config update:', req.body);
        
        // Validasi input
        if (!req.body.senderEmail || !req.body.receiverEmail) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email pengirim dan penerima harus diisi' 
            });
        }

        // Update konfigurasi
        emailConfig = {
            ...emailConfig,
            senderEmail: req.body.senderEmail,
            receiverEmail: req.body.receiverEmail,
            ccEmail: req.body.ccEmail,
            scheduleInterval: parseInt(req.body.scheduleInterval),
            emailInterval: parseInt(req.body.emailInterval || '180'),
            emailTemplate: req.body.emailTemplate
        };

        // Update jadwal
        updateSchedule(emailConfig.scheduleInterval);

        console.log('Updated config:', emailConfig);

        res.json({ 
            success: true, 
            message: 'Konfigurasi berhasil disimpan',
            config: emailConfig 
        });
    } catch (err) {
        console.error('Error saving config:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint untuk toggle monitoring
app.post('/api/toggle-monitoring', (req, res) => {
    try {
        monitoringState.isActive = !monitoringState.isActive;
        res.json({
            success: true,
            isActive: monitoringState.isActive 
        });
    } catch (err) {
        console.error('Error toggling monitoring:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Function to update schedule
function updateSchedule(intervalMinutes) {
    if (global.monitoringJob) {
        global.monitoringJob.cancel();
    }
    if (global.emailJob) {
        global.emailJob.cancel();
    }

    console.log(`Setting up new schedules: check every ${intervalMinutes} minutes, email every ${emailConfig.emailInterval} minutes`);

    // Schedule for checking data
    global.monitoringJob = schedule.scheduleJob(`*/${intervalMinutes} * * * *`, async () => {
        try {
            const data = await checkDataAndNotify();
            console.log(`Scheduled check completed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
            console.log(`Total records: ${data.length}`);
        } catch (err) {
            console.error('Scheduled check failed:', err);
        }
    });

    // Schedule for sending email
    global.emailJob = schedule.scheduleJob(`*/${emailConfig.emailInterval} * * * *`, async () => {
        try {
            const data = await checkDataAndNotify();
            if (data && data.length > 0) {
                await sendEmailNotification(data);
                console.log(`Scheduled email sent at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
            } else {
                console.log('No data to send in email');
            }
        } catch (err) {
            console.error('Scheduled email failed:', err);
        }
    });

    // Kirim email pertama saat aplikasi dimulai
    if (emailConfig.isFirstEmail) {
        setTimeout(async () => {
            try {
                const data = await checkDataAndNotify();
                if (data && data.length > 0) {
                    await sendEmailNotification(data);
                    console.log(`First email sent at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
                } else {
                    console.log('No data to send in first email');
                    emailConfig.isFirstEmail = false; // Reset flag jika tidak ada data
                }
            } catch (err) {
                console.error('First email failed:', err);
            }
        }, 10000); // Tunggu 10 detik setelah aplikasi dimulai
    }
}

// Initialize monitoring schedule
updateSchedule(emailConfig.scheduleInterval);

// Endpoint untuk mengambil data history untuk timeline chart
app.get('/api/history-data', async (req, res) => {
    try {
        // Daftar file history yang akan dibaca
        const historyFiles = [
            { type: 'tunjangan_beras', filename: 'tunjangan_beras_history.json' },
            { type: 'bpjs', filename: 'bpjs_history.json' },
            { type: 'gwscanner', filename: 'gwscanner_history.json' },
            { type: 'ffbworker', filename: 'ffbworker_history.json' }
        ];
        
        // Objek untuk menyimpan data history
        const historyData = {};
        
        // Baca setiap file history
        for (const file of historyFiles) {
            try {
                // Cek apakah file ada
                if (fs.existsSync(path.join(__dirname, 'data', file.filename))) {
                    // Baca file dan parse JSON
                    const fileContent = fs.readFileSync(path.join(__dirname, 'data', file.filename), 'utf8');
                    historyData[file.type] = JSON.parse(fileContent);
                    
                    // Log untuk debugging
                    console.log(`Berhasil membaca file history ${file.filename} dengan ${historyData[file.type].length} entri`);
                } else {
                    // Jika file tidak ada, set array kosong
                    historyData[file.type] = [];
                    console.log(`File history ${file.filename} tidak ditemukan, membuat array kosong`);
                }
            } catch (error) {
                // Jika terjadi error saat membaca file, set array kosong
                console.error(`Error saat membaca file history ${file.filename}:`, error);
                historyData[file.type] = [];
            }
        }
        
        // Kirim response dengan data history
        res.json({
            success: true,
            history: historyData
        });
    } catch (error) {
        console.error('Error saat mengambil data history:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Terjadi kesalahan saat mengambil data history'
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Open http://localhost:${port} in your browser to access the monitoring interface`);
}); 