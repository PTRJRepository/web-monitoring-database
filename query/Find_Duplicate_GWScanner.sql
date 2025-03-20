WITH DuplikatTransNoN AS (
    SELECT 
        TRANSNO
    FROM 
        [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata]
    WHERE 
        TRANSDATE >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0) -- Awal bulan ini
        AND TRANSDATE < DATEADD(month, DATEDIFF(month, 0, GETDATE()) + 1, 0) -- Awal bulan depan
        AND TRANSSTATUS = 'OK'
        AND ItechUpdateStatus = 'y'  
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
    AND g.ItechUpdateStatus = 'N'  -- Memastikan hanya yang status N
    AND g.TRANSDATE >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0)
    AND g.TRANSDATE < DATEADD(month, DATEDIFF(month, 0, GETDATE()) + 1, 0)
ORDER BY 
    g.TRANSNO,
    g.ID