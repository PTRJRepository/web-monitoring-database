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

-- Langkah 1: Mendapatkan semua kombinasi unik WORKERCODE dan tanggal transaksi
WITH WorkerDates AS (
    SELECT DISTINCT
        WORKERCODE,
        CAST(TRANSDATE AS DATE) AS TransactionDate
    FROM 
        [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata]
    WHERE 
        TRANSDATE BETWEEN @StartDate AND @EndDate
        AND ItechUpdateStatus = 'Y'
),

-- Langkah 2: Memeriksa untuk setiap kombinasi WORKERCODE dan tanggal,
-- apakah ada DocID di PR_TASKREG yang cocok dengan TRANSNO dari Gwscannerdata
WorkerDateStatus AS (
    SELECT 
        wd.WORKERCODE,
        wd.TransactionDate,
        CASE 
            WHEN COUNT(DISTINCT t.DocID) > 0 THEN 1 -- Ada minimal 1 TRANSNO yang terdaftar di TASKREG
            ELSE 0 -- Tidak ada TRANSNO yang terdaftar di TASKREG
        END AS HasAnyTaskReg
    FROM 
        WorkerDates wd
    INNER JOIN 
        [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata] g
        ON wd.WORKERCODE = g.WORKERCODE
        AND wd.TransactionDate = CAST(g.TRANSDATE AS DATE)
        AND g.ItechUpdateStatus = 'Y'
    LEFT JOIN 
        [db_ptrj].[dbo].[PR_TASKREG] t
        ON g.TRANSNO = t.DocID
    GROUP BY
        wd.WORKERCODE,
        wd.TransactionDate
)

-- Query utama: Menampilkan semua TRANSNO yang tidak ada di TASKREG untuk kombinasi WORKERCODE dan tanggal
SELECT 
    wds.WORKERCODE,
    wds.TransactionDate,
    g.TRANSNO,
    g.FROMOCCODE,
    g.TOOCCODE,
    g.SCANNERUSERCODE,
    g.FIELDNO,
    g.JOBCODE,
    g.VEHICLENO,
    g.TRANSDATE,
    g.RECORDTAG,
    g.TRANSSTATUS,
    g.ISCONTRACT,
    g.ItechUpdateStatus,
    g.DATECREATED,
    g.INTEGRATETIME,
    g.SCANOUTDATETIME,
    g.REVIEWSTATUS,
    'TIDAK ADA DI TASKREG' AS StatusDiTaskReg,
    -- Menghitung jumlah TRANSNO per WORKERCODE per tanggal
    COUNT(*) OVER (PARTITION BY wds.WORKERCODE, wds.TransactionDate) AS JumlahTransaksi
FROM 
    WorkerDateStatus wds
INNER JOIN 
    [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata] g
    ON wds.WORKERCODE = g.WORKERCODE
    AND wds.TransactionDate = CAST(g.TRANSDATE AS DATE)
    AND g.ItechUpdateStatus = 'Y'
LEFT JOIN 
    [db_ptrj].[dbo].[PR_TASKREG] t
    ON g.TRANSNO = t.DocID
WHERE 
    wds.HasAnyTaskReg = 0 -- Hanya ambil data dimana tidak ada satupun TRANSNO yang terdaftar di TASKREG
    AND t.DocID IS NULL -- Memastikan bahwa TRANSNO ini memang tidak ada di TASKREG
    AND g.TRANSSTATUS = 'OK'
ORDER BY 
    wds.WORKERCODE,
    wds.TransactionDate,
    g.TRANSNO;