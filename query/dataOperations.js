const { executeQuery } = require('./dbConnection');
const { 
    TUNJANGAN_BERAS_QUERY, 
    BPJS_QUERY, 
    GWSCANNER_QUERY, 
    FFBWORKER_QUERY 
} = require('./sqlQueries');

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
    compareData
}; 