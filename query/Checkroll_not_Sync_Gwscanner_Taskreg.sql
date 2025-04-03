-- Set periode yang ingin diperiksa (bisa disesuaikan)
DECLARE @TargetYear INT = YEAR(GETDATE());
DECLARE @StartDate DATE = DATEFROMPARTS(@TargetYear, 3, 1); -- Awal bulan Maret
DECLARE @EndDate DATE = GETDATE(); -- Sampai hari ini

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