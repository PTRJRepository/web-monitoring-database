const path = require('path');
const { getQueryFromFile } = require('../dbConnection');

// Path ke file SQL
const CHECKROLL_NOT_SYNC_GWSCANNER_TASKREG_SQL = path.join(__dirname, '../Checkroll_not_Sync_Gwscanner_Taskreg.sql');

// Konstanta query
const CHECKROLL_NOT_SYNC_GWSCANNER_TASKREG_QUERY = getQueryFromFile(CHECKROLL_NOT_SYNC_GWSCANNER_TASKREG_SQL);

module.exports = {
    CHECKROLL_NOT_SYNC_GWSCANNER_TASKREG_QUERY
}; 