const { TUNJANGAN_BERAS_QUERY, TUNJANGAN_BERAS_QUERY_ORIGINAL } = require('./tunjanganBeras/queries');
const { BPJS_QUERY } = require('./bpjs/queries');
const { DUPLICATE_GWSCANNER_QUERY, FFBWORKER_QUERY } = require('./gwscanner/queries');
const { NOT_SYNC_GWSCANNER_OVERTIME_QUERY } = require('./gwscanner-overtime/queries');

module.exports = {
    TUNJANGAN_BERAS_QUERY,
    TUNJANGAN_BERAS_QUERY_ORIGINAL,
    BPJS_QUERY,
    DUPLICATE_GWSCANNER_QUERY,
    FFBWORKER_QUERY,
    NOT_SYNC_GWSCANNER_OVERTIME_QUERY
}; 