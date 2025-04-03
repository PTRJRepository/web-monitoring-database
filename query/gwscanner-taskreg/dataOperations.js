const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { executeQuery } = require('../dbConnection');
const { CHECKROLL_NOT_SYNC_GWSCANNER_TASKREG_QUERY } = require('./queries');

// Path untuk file data
const dataDir = path.join(__dirname, '../../public/data');
const historyDir = path.join(__dirname, '../../history');

// Fungsi untuk menyimpan hasil query ke file JSON untuk tampilan
function saveQueryResultsToJson(data) {
    try {
        const filePath = path.join(dataDir, `gwscanner_taskreg_results.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Saved gwscanner_taskreg results to ${filePath} for display`);
    } catch (err) {
        console.error(`Error saving gwscanner_taskreg results to JSON:`, err);
    }
}

// Fungsi untuk menyimpan data ke history
function saveQueryHistory(data) {
    try {
        const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
        const filePath = path.join(historyDir, `gwscanner_taskreg_${timestamp}.json`);
        const historyData = {
            timestamp: new Date().toISOString(),
            dataType: 'gwscanner_taskreg',
            recordCount: data.length,
            data: data
        };
        fs.writeFileSync(filePath, JSON.stringify(historyData, null, 2));
        console.log(`Saved gwscanner_taskreg history to ${filePath}`);
        return filePath;
    } catch (err) {
        console.error(`Error saving gwscanner_taskreg history:`, err);
        return null;
    }
}

// Fungsi untuk mendapatkan data yang tidak sinkron antara GWScanner dan TaskReg
async function getNotSyncGWScannerTaskregData() {
    try {
        console.log('Executing GWScanner-TaskReg not sync query...');
        const data = await executeQuery(CHECKROLL_NOT_SYNC_GWSCANNER_TASKREG_QUERY);
        console.log(`GWScanner-TaskReg not sync query completed. Found ${data.length} records.`);
        
        // Simpan hasil query ke file JSON untuk tampilan
        saveQueryResultsToJson(data);
        
        // Simpan data ke history
        saveQueryHistory(data);
        
        return data;
    } catch (err) {
        console.error('Error getting GWScanner-TaskReg not sync data:', err);
        throw err;
    }
}

module.exports = {
    getNotSyncGWScannerTaskregData
}; 