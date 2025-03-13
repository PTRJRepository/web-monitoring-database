WITH DuplikatTransNo AS (
    SELECT 
        TRANSNO
    FROM 
        [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata]
    WHERE 
        TRANSDATE >= '2025-03-01' AND TRANSDATE < '2025-03-31'  -- Filter tanggal di CTE
        AND TRANSSTATUS = 'OK'  -- Filter status di CTE
    GROUP BY 
        TRANSNO
    HAVING 
        COUNT(*) > 1  -- Hanya TRANSNO yang muncul lebih dari sekali
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
	g.INTEGRATETIME
FROM 
    [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata] g
INNER JOIN DuplikatTransNo d ON g.TRANSNO = d.TRANSNO
WHERE 
    g.TRANSSTATUS = 'OK'  -- Filter status di query utama
    AND g.TRANSDATE >= '2025-03-01' AND g.TRANSDATE < '2025-03-31'  -- Filter tanggal di query utama
ORDER BY 
    g.TRANSNO,  -- Mengelompokkan berdasarkan TRANSNO
    g.ID        -- Mengurutkan berdasarkan ID dalam setiap kelompok