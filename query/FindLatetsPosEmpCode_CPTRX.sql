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

-- Dapatkan EmpCode dengan PosCode terbaru dari tabel HR_CPTRX
WITH LatestCPID AS (
    SELECT 
        EmpCode,
        MAX(CPID) AS MaxCPID
    FROM 
        [db_ptrj].[dbo].[HR_CPTRX]
    GROUP BY 
        EmpCode
),
EmployeePositions AS (
    SELECT 
        hr.EmpCode,
        hr.Status,
        hr.PosCode
    FROM 
        [db_ptrj].[dbo].[HR_CPTRX] hr
    INNER JOIN 
        LatestCPID lc ON hr.EmpCode = lc.EmpCode AND hr.CPID = lc.MaxCPID
),
-- Tambahkan CTE untuk menangani duplikat
WorkerData AS (
    SELECT 
        f.ID,
        f.TRANSNO,
        f.FROMOCCODE,
        f.TOOCCODE,
        f.WORKERCODE,
        f.FIELDNO,
        f.LOOSEFRUIT,
        f.RIPE,
        f.UNRIPE,
        f.OVERRIPE,
        f.TRANSDATE,
        f.TRANSSTATUS,
        e.Status AS EmployeeStatus,
        e.PosCode,
        ROW_NUMBER() OVER (PARTITION BY f.WORKERCODE ORDER BY f.TRANSDATE DESC) AS RowNum,
        COUNT(*) OVER (PARTITION BY f.WORKERCODE) AS WorkerCount
    FROM 
        [staging_PTRJ_iFES_Plantware].[dbo].[Ffbscannerdata] f
    INNER JOIN 
        EmployeePositions e ON f.WORKERCODE = e.EmpCode
    WHERE 
        f.TRANSDATE BETWEEN @StartDate AND @EndDate
        AND f.TRANSSTATUS = 'OK'
        AND f.RIPE > 0
        AND e.PosCode != 'HAR'
)
-- Query utama yang hanya mengambil satu baris per WORKERCODE
SELECT 
    ID,
    TRANSNO,
    FROMOCCODE,
    TOOCCODE,
    WORKERCODE,
    FIELDNO,
    LOOSEFRUIT,
    RIPE,
    UNRIPE,
    OVERRIPE,
    TRANSDATE,
    TRANSSTATUS,
    EmployeeStatus,
    PosCode,
    WorkerCount AS JumlahKemunculan -- Menampilkan berapa kali worker muncul
FROM 
    WorkerData
WHERE 
    RowNum = 1 -- Hanya ambil baris pertama untuk setiap WORKERCODE
ORDER BY 
    FROMOCCODE,
    WorkerCount DESC, -- Urutkan berdasarkan jumlah kemunculan (duplikat di atas)
    WORKERCODE