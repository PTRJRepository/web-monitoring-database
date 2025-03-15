-- Parameter bulan dan tahun yang bisa diubah
DECLARE @TargetMonth INT = MONTH(GETDATE()); -- Bulan saat ini
DECLARE @TargetYear INT = YEAR(GETDATE()); -- Tahun saat ini
DECLARE @StartDate DATE = DATEFROMPARTS(@TargetYear, @TargetMonth, 1);
DECLARE @EndDate DATE = EOMONTH(@StartDate);

-- Data karyawan yang memiliki transaksi di kedua tabel pada tanggal yang sama
-- dengan filter recordtag di Gwscannerdata
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
    INNER JOIN [staging_PTRJ_iFES_Plantware].[dbo].[Overtime] o ON 
        g.WORKERCODE = o.WORKERCODE AND 
        CONVERT(DATE, g.TRANSDATE) = CONVERT(DATE, o.TRANSDATE)
    LEFT JOIN [db_ptrj].[dbo].[HR_EMPLOYEE] e ON g.WORKERCODE = e.EmpCode
WHERE 
    g.TRANSDATE BETWEEN @StartDate AND @EndDate
    AND g.RECORDTAG NOT IN ('GJ', 'GV', 'GZ')
ORDER BY 
    g.WORKERCODE,
    g.TRANSDATE;