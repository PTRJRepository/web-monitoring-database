const DUPLICATE_GWSCANNER_QUERY = `
WITH DuplicateTransactions AS (
    SELECT 
        ID,
        TRANSNO,
        FROMOCCODE,
        TOOCCODE,
        SCANNERUSERCODE,
        WORKERCODE,
        FIELDNO,
        TRANSDATE,
        TRANSSTATUS,
        COUNT(*) OVER (
            PARTITION BY TRANSNO, FROMOCCODE, TOOCCODE, WORKERCODE, FIELDNO, TRANSDATE
        ) as DuplicateCount
    FROM 
        [db_ptrj].[dbo].[GWScanner_Transaction]
    WHERE 
        TRANSDATE >= DATEFROMPARTS(YEAR(GETDATE()), 3, 1)  -- Dari awal bulan Maret
        AND TRANSDATE <= GETDATE()  -- Sampai sekarang
)
SELECT 
    *
FROM 
    DuplicateTransactions
WHERE 
    DuplicateCount > 1
ORDER BY 
    TRANSNO, TRANSDATE
`;

const FFBWORKER_QUERY = `
WITH WorkerTransactions AS (
    SELECT 
        t.ID,
        t.TRANSNO,
        t.FROMOCCODE,
        t.TOOCCODE,
        t.WORKERCODE,
        t.FIELDNO,
        t.LOOSEFRUIT,
        t.RIPE,
        t.UNRIPE,
        t.OVERRIPE,
        t.TRANSDATE,
        t.TRANSSTATUS,
        e.EmpStatus,
        e.PosCode,
        COUNT(*) OVER (
            PARTITION BY t.WORKERCODE
        ) as JumlahKemunculan
    FROM 
        [db_ptrj].[dbo].[GWScanner_Transaction] t
        LEFT JOIN [db_ptrj].[dbo].[HR_EMPLOYEE] e ON t.WORKERCODE = e.EmpCode
    WHERE 
        t.TRANSDATE >= DATEFROMPARTS(YEAR(GETDATE()), 3, 1)  -- Dari awal bulan Maret
        AND t.TRANSDATE <= GETDATE()  -- Sampai sekarang
        AND e.PosCode NOT IN ('HAR')  -- Exclude harvester positions
)
SELECT 
    *
FROM 
    WorkerTransactions
WHERE 
    RIPE > 0  -- Only records with Ripe data
ORDER BY 
    WORKERCODE, TRANSDATE
`;

module.exports = {
    DUPLICATE_GWSCANNER_QUERY,
    FFBWORKER_QUERY
}; 