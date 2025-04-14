const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { executeQuery, getQueryFromFile } = require('./dbConnection');
const { 
    TUNJANGAN_BERAS_QUERY, 
    BPJS_QUERY, 
    DUPLICATE_GWSCANNER_QUERY, 
    FFBWORKER_QUERY,
    NOT_SYNC_GWSCANNER_OVERTIME_QUERY,
    CHECKROLL_NOT_SYNC_GWSCANNER_TASKREG_QUERY
} = require('./index');

// Path untuk file data dan query
const dataDir = path.join(__dirname, '../public/data');
const historyDir = path.join(__dirname, '../history');
const getTaxMonthQuery = getQueryFromFile(path.join(__dirname, 'GetTaxMonth.sql'));

// Pastikan direktori ada
[dataDir, historyDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Fungsi untuk menyimpan hasil query ke file JSON untuk tampilan
function saveQueryResultsToJson(dataType, data) {
    try {
        const filePath = path.join(dataDir, `${dataType}_results.json`);
        const jsonData = {
            lastUpdated: new Date().toISOString(),
            data: data
        };
        fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
        console.log(`Saved query results to ${filePath} for display`);
    } catch (err) {
        console.error(`Error saving ${dataType} results to JSON:`, err);
    }
}

// Fungsi untuk menyimpan data ke history
function saveQueryHistory(dataType, data) {
    try {
        // Pastikan direktori history ada
        if (!fs.existsSync(historyDir)) {
            console.log(`Creating history directory: ${historyDir}`);
            fs.mkdirSync(historyDir, { recursive: true });
        }
        
        const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
        const filePath = path.join(historyDir, `${dataType}_${timestamp}.json`);
        const historyData = {
            timestamp: new Date().toISOString(),
            dataType: dataType,
            recordCount: data.length,
            data: data
        };
        fs.writeFileSync(filePath, JSON.stringify(historyData, null, 2));
        console.log(`Saved query history to ${filePath}`);
        return filePath;
    } catch (err) {
        console.error(`Error saving ${dataType} history:`, err);
        // Tampilkan detil error
        console.error('Error details:', err.message);
        if (err.stack) console.error(err.stack);
        
        // Coba lagi dengan menghindari operasi file yang bermasalah
        try {
            console.log('Attempting to create alternative history directory...');
            const altHistoryDir = path.join(__dirname, '../history_backup');
            if (!fs.existsSync(altHistoryDir)) {
                fs.mkdirSync(altHistoryDir, { recursive: true });
            }
            
            const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
            const filePath = path.join(altHistoryDir, `${dataType}_${timestamp}.json`);
            const historyData = {
                timestamp: new Date().toISOString(),
                dataType: dataType,
                recordCount: data.length,
                // Simpan hanya sebagian data jika data terlalu besar
                data: data.slice(0, 100) 
            };
            fs.writeFileSync(filePath, JSON.stringify(historyData, null, 2));
            console.log(`Saved query history to alternative location: ${filePath}`);
            return filePath;
        } catch (backupErr) {
            console.error('Failed to save history to alternative location:', backupErr);
            return null;
        }
    }
}

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
        
        // Cek apakah direktori history ada
        if (!fs.existsSync(historyDir)) {
            console.log(`History directory not found, creating: ${historyDir}`);
            fs.mkdirSync(historyDir, { recursive: true });
            return historyData; // Kembalikan data kosong karena direktori baru dibuat
        }
        
        const files = fs.readdirSync(historyDir);
        
        // Jika tidak ada file di direktori
        if (files.length === 0) {
            console.log('No history files found');
            return historyData;
        }
        
        // Proses setiap file dalam direktori
        files.forEach(file => {
            if (file.endsWith('.json')) {
                try {
                    const filePath = path.join(historyDir, file);
                    // Verifikasi bahwa file benar-benar ada
                    if (!fs.existsSync(filePath)) {
                        console.warn(`File listed in directory but doesn't exist: ${filePath}`);
                        return;
                    }
                    
                    // Verifikasi bahwa file tidak kosong
                    const stats = fs.statSync(filePath);
                    if (stats.size === 0) {
                        console.warn(`Empty file found: ${filePath}`);
                        return;
                    }
                    
                    // Baca dan parse file
                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    if (!fileContent || fileContent.trim() === '') {
                        console.warn(`File content is empty: ${filePath}`);
                        return;
                    }
                    
                    const data = JSON.parse(fileContent);
                    
                    // Ekstrak jenis data dari nama file
                    const dataType = file.split('_')[0];
                    
                    if (historyData[dataType]) {
                        historyData[dataType].push({
                            timestamp: data.timestamp,
                            recordCount: data.recordCount || 0,
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
        
        console.log(`Successfully loaded history data: ${Object.keys(historyData).map(k => `${k}:${historyData[k].length}`).join(', ')}`);
        return historyData;
    } catch (err) {
        console.error('Error loading history data:', err);
        console.error('Error details:', err.message);
        if (err.stack) console.error(err.stack);
        
        // Kembalikan objek kosong tapi dengan struktur yang benar
        return {
            tunjangan_beras: [],
            bpjs: [],
            gwscanner: [],
            ffbworker: [],
            gwscanner_overtime_not_sync: [],
            gwscanner_taskreg: []
        };
    }
}

// Fungsi untuk memuat data history berdasarkan nama file
function loadHistoryDataByFileName(fileName) {
    try {
        const filePath = path.join(historyDir, fileName);
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return data;
        }
        return null;
    } catch (err) {
        console.error(`Error loading history data from ${fileName}:`, err);
        return null;
    }
}

// Fungsi untuk mendapatkan data tunjangan beras
async function getTunjanganBerasData() {
    try {
        // Menggunakan query dari file SQL
        const data = await executeQuery(TUNJANGAN_BERAS_QUERY);
        
        // Simpan hasil query ke file JSON untuk tampilan
        saveQueryResultsToJson('tunjangan_beras', data);
        
        // Simpan data ke history
        saveQueryHistory('tunjangan_beras', data);
        
        return data;
    } catch (err) {
        console.error('Error getting tunjangan beras data:', err);
        throw err;
    }
}

// Fungsi untuk mendapatkan data BPJS
async function getBPJSData() {
    try {
        const data = await executeQuery(BPJS_QUERY);
        
        // Simpan hasil query ke file JSON untuk tampilan
        saveQueryResultsToJson('bpjs', data);
        
        // Simpan data ke history
        saveQueryHistory('bpjs', data);
        
        return data;
    } catch (err) {
        console.error('Error getting BPJS data:', err);
        throw err;
    }
}

// Fungsi untuk mendapatkan data GWScanner
async function getGWScannerData() {
    try {
        const data = await executeQuery(DUPLICATE_GWSCANNER_QUERY);
        
        // Simpan hasil query ke file JSON untuk tampilan
        saveQueryResultsToJson('gwscanner', data);
        
        // Simpan data ke history
        saveQueryHistory('gwscanner', data);
        
        return data;
    } catch (err) {
        console.error('Error getting GWScanner data:', err);
        throw err;
    }
}

// Fungsi untuk mendapatkan data FFB Worker
async function getFFBWorkerData() {
    try {
        const data = await executeQuery(FFBWORKER_QUERY);
        
        // Simpan hasil query ke file JSON untuk tampilan
        saveQueryResultsToJson('ffbworker', data);
        
        // Simpan data ke history
        saveQueryHistory('ffbworker', data);
        
        return data;
    } catch (err) {
        console.error('Error getting FFB Worker data:', err);
        throw err;
    }
}

// Fungsi untuk membandingkan data baru dengan data lama
function compareData(newData, oldData) {
    if (!oldData) return { added: newData, removed: [], changed: [] };

    const added = newData.filter(newItem => 
        !oldData.some(oldItem => oldItem.EmpCode === newItem.EmpCode)
    );

    const removed = oldData.filter(oldItem => 
        !newData.some(newItem => newItem.EmpCode === oldItem.EmpCode)
    );

    const changed = newData.filter(newItem => {
        const oldItem = oldData.find(item => item.EmpCode === newItem.EmpCode);
        return oldItem && JSON.stringify(newItem) !== JSON.stringify(oldItem);
    });

    return { added, removed, changed };
}

// Fungsi untuk mendapatkan data yang tidak sinkron antara GWScanner dan Overtime
async function getNotSyncGWScannerOvertimeData() {
    try {
        console.log('Executing GWScanner-Overtime not sync query...');
        const data = await executeQuery(NOT_SYNC_GWSCANNER_OVERTIME_QUERY);
        console.log(`GWScanner-Overtime not sync query completed. Found ${data.length} records.`);
        
        // Simpan hasil query ke file JSON untuk tampilan
        saveQueryResultsToJson('gwscanner_overtime_not_sync', data);
        
        // Simpan data ke history
        saveQueryHistory('gwscanner_overtime_not_sync', data);
        
        return data;
    } catch (err) {
        console.error('Error getting GWScanner-Overtime not sync data:', err);
        throw err;
    }
}

// Fungsi untuk mendapatkan data yang tidak sinkron antara GWScanner dan TaskReg
async function getNotSyncGWScannerTaskregData() {
    try {
        console.log('Executing GWScanner-TaskReg not sync query...');
        const data = await executeQuery(CHECKROLL_NOT_SYNC_GWSCANNER_TASKREG_QUERY);
        console.log(`GWScanner-TaskReg not sync query completed. Found ${data.length} records.`);
        
        // Simpan hasil query ke file JSON untuk tampilan
        saveQueryResultsToJson('gwscanner_taskreg', data);
        
        // Simpan data ke history
        saveQueryHistory('gwscanner_taskreg', data);
        
        return data;
    } catch (err) {
        console.error('Error getting GWScanner-TaskReg not sync data:', err);
        throw err;
    }
}

// Fungsi untuk mendapatkan data periode pajak/pembukuan
async function getTaxMonth() {
    try {
        console.log('Executing getTaxMonth query directly from database...');
        const data = await executeQuery(getTaxMonthQuery);
        
        if (data && data.length > 0) {
            // Simpan hasil query ke file JSON untuk penggunaan global tapi tidak digunakan sebagai cache
            saveQueryResultsToJson('tax_month', data[0]);
            return data[0];
        }
        
        // Jika tidak ada data, gunakan fallback sederhana tanpa caching
        console.log('No tax month data found, using fallback data');
        const fallbackData = {
            NextAccMonth: 1,
            CalendarMonth: 4,
            ProcessMonthName: 'April',
            ProcessYear: new Date().getFullYear(),
            ProcessDate: new Date(`${new Date().getFullYear()}-04-01`),
            LastProcessDate: new Date()
        };
        
        return fallbackData;
    } catch (err) {
        console.error('Error getting tax month data:', err);
        
        // Jika terjadi error, gunakan fallback data sederhana
        console.log('Error occurred, using fallback tax month data');
        const fallbackData = {
            NextAccMonth: 1,
            CalendarMonth: 4,
            ProcessMonthName: 'April',
            ProcessYear: new Date().getFullYear(),
            ProcessDate: new Date(`${new Date().getFullYear()}-04-01`),
            LastProcessDate: new Date()
        };
        
        return fallbackData;
    }
}

module.exports = {
    saveQueryResultsToJson,
    saveQueryHistory,
    getTunjanganBerasData,
    getBPJSData,
    getGWScannerData,
    getFFBWorkerData,
    getNotSyncGWScannerOvertimeData,
    getNotSyncGWScannerTaskregData,
    loadAllHistoryData,
    loadHistoryDataByFileName,
    compareData,
    getTaxMonth
}; 