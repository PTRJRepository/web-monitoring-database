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

-- CTE untuk mengidentifikasi karyawan dengan status OK dan CANCELLATION pada hari yang sama
WITH EmployeeWithBothStatuses AS (
    SELECT 
        WORKERCODE,
        CAST(TRANSDATE AS DATE) AS TransactionDate
    FROM 
        [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata]
    WHERE 
        TRANSDATE BETWEEN @StartDate AND @EndDate
        AND TRANSSTATUS IN ('OK', 'CANCELLATION') -- Filter awal untuk efisiensi
    GROUP BY 
        WORKERCODE, 
        CAST(TRANSDATE AS DATE)
    HAVING 
        COUNT(CASE WHEN TRANSSTATUS = 'OK' THEN 1 END) > 0
        AND COUNT(CASE WHEN TRANSSTATUS = 'CANCELLATION' THEN 1 END) > 0
)

-- Query utama: Data karyawan dengan transaksi di kedua tabel, kecuali yang memiliki OK dan CANCELLATION pada hari yang sama
SELECT
    g.TRANSSTATUS AS Status_GWScanner,
    o.TRANSSTATUS AS Status_Overtime,
    g.WORKERCODE AS EmpCode,
    e.EmpName,
    CONVERT(DATE, g.TRANSDATE) AS TanggalTransaksi,
    g.RECORDTAG AS RecordTag_GWScanner,
    o.RECORDTAG AS RecordTag_Overtime,
    g.TRANSNO AS TransNo_GWScanner,
    o.TRANSNO AS TransNo_Overtime,
    g.FROMOCCODE AS FromCode_GWScanner
FROM 
    [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata] g
    INNER JOIN [staging_PTRJ_iFES_Plantware].[dbo].[Overtime] o 
        ON g.WORKERCODE = o.WORKERCODE 
        AND CONVERT(DATE, g.TRANSDATE) = CONVERT(DATE, o.TRANSDATE)
    LEFT JOIN [db_ptrj].[dbo].[HR_EMPLOYEE] e 
        ON g.WORKERCODE = e.EmpCode
    LEFT JOIN EmployeeWithBothStatuses ebs 
        ON g.WORKERCODE = ebs.WORKERCODE 
        AND CONVERT(DATE, g.TRANSDATE) = ebs.TransactionDate
WHERE 
    g.TRANSDATE BETWEEN @StartDate AND @EndDate
    AND g.RECORDTAG NOT IN ('GJ', 'GV', 'GZ')
    AND ebs.WORKERCODE IS NULL -- Mengecualikan karyawan yang memiliki OK dan CANCELLATION pada hari yang sama
ORDER BY 
    g.WORKERCODE,
    g.TRANSDATE;