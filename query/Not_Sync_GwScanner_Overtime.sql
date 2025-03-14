-- Parameter bulan dan tahun otomatis menggunakan bulan dan tahun saat ini
DECLARE @TargetMonth INT = MONTH(GETDATE()); -- Bulan saat ini
DECLARE @TargetYear INT = YEAR(GETDATE()); -- Tahun saat ini

-- Mencari workercode yang ada di Overtime tapi tidak ada di GWScanner 
-- untuk bulan saat ini
SELECT 
    o.WORKERCODE,
    o.TRANSDATE,
    o.TRANSNO,
    o.FROMOCCODE,
    o.TOOCCODE,
    o.TRANSSTATUS,
    'Ada di Overtime tapi tidak ada di GWScanner' AS Status
FROM 
    [staging_PTRJ_iFES_Plantware].[dbo].[Overtime] o
WHERE 
    MONTH(o.TRANSDATE) = @TargetMonth
    AND YEAR(o.TRANSDATE) = @TargetYear
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