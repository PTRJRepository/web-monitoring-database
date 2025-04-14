const DUPLICATE_GWSCANNER_QUERY = `
-- Menggunakan periode dari GetTaxMonth
DECLARE @ProcessDate DATETIME;
DECLARE @CalendarMonth INT;
DECLARE @ProcessYear INT;

-- Mendapatkan data dari SH_MTHEND
SELECT TOP 1
    @CalendarMonth = CalendarMonth,
    @ProcessYear = ProcessYear,
    @ProcessDate = ProcessDate
FROM 
    (
        -- Query ini sama dengan GetTaxMonth.sql
        SELECT 
            NextAccMonth,
            CASE
                WHEN NextAccMonth = 1 THEN 4  -- April
                WHEN NextAccMonth = 2 THEN 5  -- Mei
                WHEN NextAccMonth = 3 THEN 6  -- Juni
                WHEN NextAccMonth = 4 THEN 7  -- Juli
                WHEN NextAccMonth = 5 THEN 8  -- Agustus
                WHEN NextAccMonth = 6 THEN 9  -- September
                WHEN NextAccMonth = 7 THEN 10 -- Oktober
                WHEN NextAccMonth = 8 THEN 11 -- November
                WHEN NextAccMonth = 9 THEN 12 -- Desember
                WHEN NextAccMonth = 10 THEN 1 -- Januari
                WHEN NextAccMonth = 11 THEN 2 -- Februari
                WHEN NextAccMonth = 12 THEN 3 -- Maret
            END AS CalendarMonth,
            DATENAME(MONTH, DATEFROMPARTS(
                CASE 
                    WHEN NextAccMonth >= 10 THEN CurrAccYear + 1 
                    ELSE CurrAccYear 
                END, 
                CASE
                    WHEN NextAccMonth = 1 THEN 4
                    WHEN NextAccMonth = 2 THEN 5
                    WHEN NextAccMonth = 3 THEN 6
                    WHEN NextAccMonth = 4 THEN 7
                    WHEN NextAccMonth = 5 THEN 8
                    WHEN NextAccMonth = 6 THEN 9
                    WHEN NextAccMonth = 7 THEN 10
                    WHEN NextAccMonth = 8 THEN 11
                    WHEN NextAccMonth = 9 THEN 12
                    WHEN NextAccMonth = 10 THEN 1
                    WHEN NextAccMonth = 11 THEN 2
                    WHEN NextAccMonth = 12 THEN 3
                END, 
                1
            )) AS ProcessMonthName,
            CASE 
                WHEN NextAccMonth >= 10 THEN CurrAccYear + 1 
                ELSE CurrAccYear 
            END AS ProcessYear,
            DATEFROMPARTS(
                CASE 
                    WHEN NextAccMonth >= 10 THEN CurrAccYear + 1 
                    ELSE CurrAccYear 
                END, 
                CASE
                    WHEN NextAccMonth = 1 THEN 4
                    WHEN NextAccMonth = 2 THEN 5
                    WHEN NextAccMonth = 3 THEN 6
                    WHEN NextAccMonth = 4 THEN 7
                    WHEN NextAccMonth = 5 THEN 8
                    WHEN NextAccMonth = 6 THEN 9
                    WHEN NextAccMonth = 7 THEN 10
                    WHEN NextAccMonth = 8 THEN 11
                    WHEN NextAccMonth = 9 THEN 12
                    WHEN NextAccMonth = 10 THEN 1
                    WHEN NextAccMonth = 11 THEN 2
                    WHEN NextAccMonth = 12 THEN 3
                END, 
                1
            ) AS ProcessDate
        FROM 
            [db_ptrj].[dbo].[SH_MTHEND]
        WHERE 
            ModuleCode = 8
    ) AS TaxMonth
ORDER BY 
    ProcessDate DESC;

-- Tanggal awal bulan dari periode pembukuan
DECLARE @StartDate DATE = DATEFROMPARTS(@ProcessYear, @CalendarMonth, 1);

-- Tanggal akhir (bulan berikutnya - 1 hari)
DECLARE @EndDate DATE = DATEADD(DAY, -1, DATEADD(MONTH, 1, @StartDate));

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
        TRANSDATE >= @StartDate  -- Menggunakan start date dari periode pembukuan
        AND TRANSDATE <= @EndDate  -- Menggunakan end date dari periode pembukuan
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
-- Menggunakan periode dari GetTaxMonth
DECLARE @ProcessDate DATETIME;
DECLARE @CalendarMonth INT;
DECLARE @ProcessYear INT;

-- Mendapatkan data dari SH_MTHEND
SELECT TOP 1
    @CalendarMonth = CalendarMonth,
    @ProcessYear = ProcessYear,
    @ProcessDate = ProcessDate
FROM 
    (
        -- Query ini sama dengan GetTaxMonth.sql
        SELECT 
            NextAccMonth,
            CASE
                WHEN NextAccMonth = 1 THEN 4  -- April
                WHEN NextAccMonth = 2 THEN 5  -- Mei
                WHEN NextAccMonth = 3 THEN 6  -- Juni
                WHEN NextAccMonth = 4 THEN 7  -- Juli
                WHEN NextAccMonth = 5 THEN 8  -- Agustus
                WHEN NextAccMonth = 6 THEN 9  -- September
                WHEN NextAccMonth = 7 THEN 10 -- Oktober
                WHEN NextAccMonth = 8 THEN 11 -- November
                WHEN NextAccMonth = 9 THEN 12 -- Desember
                WHEN NextAccMonth = 10 THEN 1 -- Januari
                WHEN NextAccMonth = 11 THEN 2 -- Februari
                WHEN NextAccMonth = 12 THEN 3 -- Maret
            END AS CalendarMonth,
            DATENAME(MONTH, DATEFROMPARTS(
                CASE 
                    WHEN NextAccMonth >= 10 THEN CurrAccYear + 1 
                    ELSE CurrAccYear 
                END, 
                CASE
                    WHEN NextAccMonth = 1 THEN 4
                    WHEN NextAccMonth = 2 THEN 5
                    WHEN NextAccMonth = 3 THEN 6
                    WHEN NextAccMonth = 4 THEN 7
                    WHEN NextAccMonth = 5 THEN 8
                    WHEN NextAccMonth = 6 THEN 9
                    WHEN NextAccMonth = 7 THEN 10
                    WHEN NextAccMonth = 8 THEN 11
                    WHEN NextAccMonth = 9 THEN 12
                    WHEN NextAccMonth = 10 THEN 1
                    WHEN NextAccMonth = 11 THEN 2
                    WHEN NextAccMonth = 12 THEN 3
                END, 
                1
            )) AS ProcessMonthName,
            CASE 
                WHEN NextAccMonth >= 10 THEN CurrAccYear + 1 
                ELSE CurrAccYear 
            END AS ProcessYear,
            DATEFROMPARTS(
                CASE 
                    WHEN NextAccMonth >= 10 THEN CurrAccYear + 1 
                    ELSE CurrAccYear 
                END, 
                CASE
                    WHEN NextAccMonth = 1 THEN 4
                    WHEN NextAccMonth = 2 THEN 5
                    WHEN NextAccMonth = 3 THEN 6
                    WHEN NextAccMonth = 4 THEN 7
                    WHEN NextAccMonth = 5 THEN 8
                    WHEN NextAccMonth = 6 THEN 9
                    WHEN NextAccMonth = 7 THEN 10
                    WHEN NextAccMonth = 8 THEN 11
                    WHEN NextAccMonth = 9 THEN 12
                    WHEN NextAccMonth = 10 THEN 1
                    WHEN NextAccMonth = 11 THEN 2
                    WHEN NextAccMonth = 12 THEN 3
                END, 
                1
            ) AS ProcessDate
        FROM 
            [db_ptrj].[dbo].[SH_MTHEND]
        WHERE 
            ModuleCode = 8
    ) AS TaxMonth
ORDER BY 
    ProcessDate DESC;

-- Tanggal awal bulan dari periode pembukuan
DECLARE @StartDate DATE = DATEFROMPARTS(@ProcessYear, @CalendarMonth, 1);

-- Tanggal akhir (bulan berikutnya - 1 hari)
DECLARE @EndDate DATE = DATEADD(DAY, -1, DATEADD(MONTH, 1, @StartDate));

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
        t.TRANSDATE >= @StartDate  -- Menggunakan start date dari periode pembukuan
        AND t.TRANSDATE <= @EndDate  -- Menggunakan end date dari periode pembukuan
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