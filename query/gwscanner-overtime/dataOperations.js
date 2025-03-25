const { executeQuery } = require('../dbConnection');
const { 
    NOT_SYNC_GWSCANNER_OVERTIME_QUERY 
} = require('./queries');
const { 
    saveQueryResultsToJson, 
    saveQueryHistory 
} = require('../dataOperations');

// Fungsi untuk mendapatkan data yang tidak sinkron antara GWScanner dan Overtime
async function getNotSyncGWScannerOvertimeData() {
    try {
        console.log('Executing GWScanner-Overtime not sync query...');
        
        const data = await executeQuery(NOT_SYNC_GWSCANNER_OVERTIME_QUERY);
        console.log(`GWScanner-Overtime not sync query completed. Found ${data.length} records.`);
        
        if (data.length === 0) {
            console.log('No unsynchronized data found between GWScanner and Overtime.');
        } else {
            console.log(`Found ${data.length} records that exist in Overtime but not in GWScanner.`);
        }
        
        // Simpan hasil query ke file JSON untuk tampilan
        saveQueryResultsToJson('gwscanner_overtime_not_sync', data);
        
        // Simpan data ke history
        saveQueryHistory('gwscanner_overtime_not_sync', data);
        
        return data;
    } catch (err) {
        console.error('Error getting GWScanner-Overtime not sync data:', err);
        console.error('Error details:', err.message);
        
        // Return array kosong alih-alih throw error
        console.log('Returning empty array due to error in getNotSyncGWScannerOvertimeData');
        return [];
    }
}

module.exports = {
    getNotSyncGWScannerOvertimeData
}; 