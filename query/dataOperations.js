const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { executeQuery, getQueryFromFile } = require('./dbConnection');
const { 
    TUNJANGAN_BERAS_QUERY, 
    BPJS_QUERY, 
    DUPLICATE_GWSCANNER_QUERY, 
    FFBWORKER_QUERY 
} = require('./index');

// Path untuk file data
const dataDir = path.join(__dirname, '../public/data');
const historyDir = path.join(__dirname, '../history');

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
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Saved query results to ${filePath} for display`);
    } catch (err) {
        console.error(`Error saving ${dataType} results to JSON:`, err);
    }
}

// Fungsi untuk menyimpan data ke history
function saveQueryHistory(dataType, data) {
    try {
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
        return null;
    }
}

// Fungsi untuk memuat semua data history
function loadAllHistoryData() {
    try {
        const historyData = {
            tunjangan_beras: [],
            bpjs: [],
            gwscanner: [],
            ffbworker: []
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
        
        return historyData;
    } catch (err) {
        console.error('Error loading history data:', err);
        return {};
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

module.exports = {
    getTunjanganBerasData,
    getBPJSData,
    getGWScannerData,
    getFFBWorkerData,
    saveQueryResultsToJson,
    saveQueryHistory,
    loadAllHistoryData,
    loadHistoryDataByFileName,
    compareData
}; 