const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { executeQuery, getQueryFromFile } = require('./dbConnection');
const { 
    TUNJANGAN_BERAS_QUERY, 
    BPJS_QUERY, 
    GWSCANNER_QUERY, 
    FFBWORKER_QUERY 
} = require('./sqlQueries');

// Path untuk file query
const queryPaths = {
    tunjangan_beras: './tunjanganBeras/Incorrect_Input_Jatah_Beras_Based_Employee_Child_Count_Ages.sql',
    bpjs: './bpjs/Not_Completed_BPJS.sql',
    gwscanner: './gwscanner/Find_Duplicate_GWScanner.sql',
    ffbworker: './FindLatetsPosEmpCode_CPTRX.sql',
    skuh_employees: './Find_SKUH_Employees.sql'
};

// Path untuk file data
const dataDir = path.join(__dirname, '../public/data');
const historyDir = path.join(__dirname, '../history');
const tempDir = path.join(__dirname, '../temp');

// Pastikan direktori ada
[dataDir, historyDir, tempDir].forEach(dir => {
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

// Fungsi untuk menyimpan data ke file temporary
function saveTempData(dataType, data) {
    try {
        const filePath = path.join(tempDir, `${dataType}_temp.json`);
        const tempData = {
            timestamp: new Date().toISOString(),
            data: data
        };
        fs.writeFileSync(filePath, JSON.stringify(tempData, null, 2));
        console.log(`Saved temporary ${dataType} data`);
    } catch (err) {
        console.error(`Error saving temporary ${dataType} data:`, err);
    }
}

// Fungsi untuk memuat data dari file temporary
function loadTempData(dataType) {
    try {
        const filePath = path.join(tempDir, `${dataType}_temp.json`);
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return data;
        }
        return null;
    } catch (err) {
        console.error(`Error loading temporary ${dataType} data:`, err);
        return null;
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

// Fungsi untuk menjalankan query berdasarkan jenis
async function runQueryByType(dataType, params = {}) {
    try {
        if (!queryPaths[dataType]) {
            throw new Error(`Query path not defined for data type: ${dataType}`);
        }
        
        const queryPath = queryPaths[dataType];
        const query = getQueryFromFile(queryPath);
        
        console.log(`Executing ${dataType} query...`);
        const result = await executeQuery(query, params);
        console.log(`${dataType} query completed. Found ${result.length} records.`);
        
        // Simpan data ke history
        saveQueryHistory(dataType, result);
        
        // Simpan hasil query ke file JSON untuk tampilan
        saveQueryResultsToJson(dataType, result);
        
        // Simpan ke temporary file
        saveTempData(dataType, result);
        
        return result;
    } catch (err) {
        console.error(`Error running ${dataType} query:`, err);
        
        // Jika terjadi error, gunakan data dari file temporary jika ada
        const tempData = loadTempData(dataType);
        if (tempData && tempData.data.length > 0) {
            console.log(`Using temporary data for ${dataType} (${tempData.data.length} records)`);
            return tempData.data;
        }
        
        throw err;
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
        const data = await executeQuery(TUNJANGAN_BERAS_QUERY);
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
        return data;
    } catch (err) {
        console.error('Error getting BPJS data:', err);
        throw err;
    }
}

// Fungsi untuk mendapatkan data GWScanner
async function getGWScannerData() {
    try {
        const data = await executeQuery(GWSCANNER_QUERY);
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
        return data;
    } catch (err) {
        console.error('Error getting FFB Worker data:', err);
        throw err;
    }
}

// Fungsi untuk menyimpan data ke file JSON
async function saveDataToFile(data, filename) {
    try {
        const fs = require('fs').promises;
        await fs.writeFile(filename, JSON.stringify(data, null, 2));
        console.log(`Data saved to ${filename}`);
    } catch (err) {
        console.error(`Error saving data to ${filename}:`, err);
        throw err;
    }
}

// Fungsi untuk membaca data dari file JSON
async function loadDataFromFile(filename) {
    try {
        const fs = require('fs').promises;
        const data = await fs.readFile(filename, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`No previous data found in ${filename}`);
            return null;
        }
        console.error(`Error loading data from ${filename}:`, err);
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
    saveDataToFile,
    loadDataFromFile,
    compareData,
    saveQueryResultsToJson,
    saveTempData,
    loadTempData,
    saveQueryHistory,
    runQueryByType,
    loadAllHistoryData,
    loadHistoryDataByFileName
}; 