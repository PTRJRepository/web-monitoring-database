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

WITH DuplikatTransNoN AS (
    SELECT 
        TRANSNO
    FROM 
        [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata]
    WHERE 
        TRANSDATE BETWEEN @StartDate AND @EndDate
        AND TRANSSTATUS = 'OK'
    GROUP BY 
        TRANSNO
    HAVING 
        COUNT(*) > 1  -- Hanya TRANSNO yang muncul lebih dari sekali dengan status N
)
SELECT 
    g.ID,
    g.TRANSNO,
    g.FROMOCCODE,
    g.TOOCCODE,
    g.SCANNERUSERCODE,
    g.WORKERCODE,
    g.FIELDNO,
    g.JOBCODE,
    g.VEHICLENO,
    g.TRANSDATE,
    g.RECORDTAG,
    g.TRANSSTATUS,
    g.ISCONTRACT,
    g.DATECREATED,
    g.SCANOUTDATETIME,
    g.INTEGRATETIME,
    g.ItechUpdateStatus
FROM 
    [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata] g
INNER JOIN DuplikatTransNoN d ON g.TRANSNO = d.TRANSNO
WHERE 
    g.TRANSSTATUS = 'OK'
    AND g.TRANSDATE BETWEEN @StartDate AND @EndDate
ORDER BY 
    g.TRANSNO,
    g.ID