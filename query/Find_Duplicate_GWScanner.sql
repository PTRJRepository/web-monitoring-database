WITH DuplikatTransNoN AS (
    SELECT 
        TRANSNO
    FROM 
        [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata]
    WHERE 
        TRANSDATE >= DATEFROMPARTS(YEAR(GETDATE()), 3, 1) -- Awal bulan Maret
        AND TRANSDATE <= GETDATE() -- Sampai hari ini
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
    AND g.TRANSDATE >= DATEFROMPARTS(YEAR(GETDATE()), 3, 1) -- Awal bulan Maret
    AND g.TRANSDATE <= GETDATE() -- Sampai hari ini
ORDER BY 
    g.TRANSNO,
    g.ID