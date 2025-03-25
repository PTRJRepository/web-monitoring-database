-- Parameter bulan dan tahun yang bisa diubah (default: bulan dan tahun saat ini)
DECLARE @TargetMonth INT = 1; -- Bulan saat ini
DECLARE @TargetYear INT = YEAR(GETDATE());   -- Tahun saat ini
DECLARE @StartDate DATE = DATEFROMPARTS(@TargetYear, @TargetMonth, 1);
DECLARE @EndDate DATE = EOMONTH(@StartDate);

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