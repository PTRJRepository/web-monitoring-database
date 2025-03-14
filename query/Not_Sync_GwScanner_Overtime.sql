-- Query untuk menemukan data yang ada di Overtime tapi belum ada di GWScanner
-- Parameter bulan dan tahun otomatis menggunakan bulan dan tahun saat ini
DECLARE @TargetMonth INT = MONTH(GETDATE()); -- Bulan saat ini
DECLARE @TargetYear INT = YEAR(GETDATE()); -- Tahun saat ini
DECLARE @StartDate DATE = DATEFROMPARTS(@TargetYear, @TargetMonth, 1); -- Tanggal awal bulan
DECLARE @EndDate DATE = EOMONTH(@StartDate); -- Tanggal akhir bulan

-- Data yang ada di Overtime tapi tidak ada di GWScanner
SELECT 
    o.WORKERCODE,
    o.TRANSDATE,
    o.TRANSNO,
    o.FROMOCCODE,
    o.TOOCCODE,
    o.TRANSSTATUS,
    e.EmpName,
    emp.PosCode,
    'Ada di Overtime tapi tidak ada di GWScanner' AS Status
FROM 
    [staging_PTRJ_iFES_Plantware].[dbo].[Overtime] o
    LEFT JOIN [db_ptrj].[dbo].[HR_EMPLOYEE] e ON o.WORKERCODE = e.EmpCode
    LEFT JOIN [db_ptrj].[dbo].[HR_EMPLOYMENT] emp ON o.WORKERCODE = emp.EmpCode
WHERE 
    o.TRANSDATE BETWEEN @StartDate AND @EndDate
    AND o.TRANSSTATUS = 'OK'  -- Memastikan hanya data dengan status OK
    AND NOT EXISTS (
        SELECT 1 
        FROM [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata] g
        WHERE 
            g.WORKERCODE = o.WORKERCODE
            AND CONVERT(DATE, g.TRANSDATE) = CONVERT(DATE, o.TRANSDATE)
    )
ORDER BY 
    o.WORKERCODE, 
    o.TRANSDATE;