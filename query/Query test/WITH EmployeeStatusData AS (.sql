WITH EmployeeStatusData AS (
    SELECT 
        WORKERCODE,
        CAST(TRANSDATE AS DATE) AS TransactionDate,
        COUNT(CASE WHEN TRANSSTATUS = 'OK' THEN 1 END) AS OkCount,
        COUNT(CASE WHEN TRANSSTATUS = 'CANCELLATION' THEN 1 END) AS CancellationCount
    FROM 
        [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata]
    WHERE 
        TRANSDATE >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0) -- Start of current month
        AND TRANSDATE < DATEADD(month, DATEDIFF(month, 0, GETDATE()) + 1, 0) -- Start of next month
    GROUP BY 
        WORKERCODE, CAST(TRANSDATE AS DATE)
    HAVING 
        COUNT(CASE WHEN TRANSSTATUS = 'OK' THEN 1 END) > 0
        AND COUNT(CASE WHEN TRANSSTATUS = 'CANCELLATION' THEN 1 END) > 0
)

SELECT 
    g.ID,
    g.FROMOCCODE,
    g.TOOCCODE,
    g.SCANNERUSERCODE,
    g.WORKERCODE,
    g.FIELDNO,
    g.JOBCODE,
    g.VEHICLENO,
    g.TRANSNO,
    g.TRANSDATE,
    g.RECORDTAG,
    g.TRANSSTATUS,
    g.ISCONTRACT,
    g.CREATEDBY,
    g.DATECREATED,
    g.INTEGRATETIME,
    g.FLAG,
    g.SCANOUTDATETIME,
    g.REVIEWSTATUS,
    g.ItechUpdateStatus
FROM 
    [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata] g
INNER JOIN 
    EmployeeStatusData e ON g.WORKERCODE = e.WORKERCODE 
    AND CAST(g.TRANSDATE AS DATE) = e.TransactionDate
WHERE 
    g.TRANSSTATUS IN ('OK', 'CANCELLATION')
    AND g.TRANSDATE >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0)
    AND g.TRANSDATE < DATEADD(month, DATEDIFF(month, 0, GETDATE()) + 1, 0)
ORDER BY 
    g.WORKERCODE, 
    g.TRANSDATE,
    g.TRANSSTATUS