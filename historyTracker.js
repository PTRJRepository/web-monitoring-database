const fs = require('fs');
const path = require('path');
const moment = require('moment');

class HistoryTracker {
    constructor(filePath) {
        this.filePath = filePath;
        this.history = {};
        this.uniqueFields = {
            tunjangan_beras: "EmpCode",
            bpjs: "EmpCode", 
            gwscanner: "TRANSNO",
            ffbworker: "WORKERCODE"
        };
        this.loadHistory();
    }

    loadHistory() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, 'utf8');
                this.history = JSON.parse(data);
                console.log(`Loaded history with ${Object.keys(this.history).length} categories`);
            } else {
                // Buat struktur dasar jika file tidak ada
                this.history = {
                    tunjangan_beras: {},
                    bpjs: {},
                    gwscanner: {},
                    ffbworker: {}
                };
                this.saveHistory();
                console.log('Created new history file');
            }
        } catch (error) {
            console.error('Error loading history:', error);
            // Reset history jika terjadi error
            this.history = {
                tunjangan_beras: {},
                bpjs: {},
                gwscanner: {},
                ffbworker: {}
            };
            this.saveHistory();
        }
    }

    saveHistory() {
        try {
            const dirPath = path.dirname(this.filePath);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            fs.writeFileSync(this.filePath, JSON.stringify(this.history, null, 2), 'utf8');
        } catch (error) {
            console.error('Error saving history:', error);
        }
    }

    recordEntries(dataType, records) {
        if (!this.history[dataType]) {
            this.history[dataType] = {};
        }

        const uniqueField = this.uniqueFields[dataType];
        if (!uniqueField) {
            console.error(`No unique field defined for data type: ${dataType}`);
            return;
        }

        const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');
        let newEntries = 0;

        records.forEach(record => {
            const uniqueValue = record[uniqueField];
            if (uniqueValue) {
                if (!this.history[dataType][uniqueValue]) {
                    // Baru pertama kali muncul
                    this.history[dataType][uniqueValue] = {
                        firstSeen: currentTime,
                        lastSeen: currentTime,
                        occurrences: 1,
                        data: record
                    };
                    newEntries++;
                } else {
                    // Update data yang sudah ada
                    this.history[dataType][uniqueValue].lastSeen = currentTime;
                    this.history[dataType][uniqueValue].occurrences++;
                    this.history[dataType][uniqueValue].data = record;
                }
            }
        });

        // Save setelah update
        this.saveHistory();
        console.log(`Recorded ${records.length} entries for ${dataType}, ${newEntries} new unique entries`);
        
        return {
            total: records.length,
            newEntries: newEntries
        };
    }

    getHistory(dataType, timeRange = null) {
        if (!this.history[dataType]) {
            return [];
        }

        let result = Object.values(this.history[dataType]).map(entry => ({
            ...entry,
            uniqueValue: entry.data[this.uniqueFields[dataType]]
        }));

        // Filter berdasarkan timeRange jika ada
        if (timeRange) {
            const cutoffTime = moment().subtract(timeRange, 'hours').format('YYYY-MM-DD HH:mm:ss');
            result = result.filter(entry => entry.firstSeen >= cutoffTime);
        }

        return result;
    }

    getHistoryStats() {
        const stats = {};
        
        Object.keys(this.history).forEach(dataType => {
            const entries = Object.keys(this.history[dataType]).length;
            
            // Count new entries in last 24 hours
            const cutoffTime = moment().subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ss');
            const newEntries = Object.values(this.history[dataType])
                .filter(entry => entry.firstSeen >= cutoffTime).length;
                
            stats[dataType] = {
                total: entries,
                newLast24Hours: newEntries
            };
        });
        
        return stats;
    }
}

module.exports = HistoryTracker; 