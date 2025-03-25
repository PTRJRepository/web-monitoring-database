const path = require('path');
const { getQueryFromFile } = require('../dbConnection');

// Path ke file SQL
const NOT_SYNC_GWSCANNER_OVERTIME_SQL = path.join(__dirname, '../Not_Sync_GwScanner_Overtime.sql');

// Konstanta query
const NOT_SYNC_GWSCANNER_OVERTIME_QUERY = getQueryFromFile(NOT_SYNC_GWSCANNER_OVERTIME_SQL);

module.exports = {
    NOT_SYNC_GWSCANNER_OVERTIME_QUERY
}; 