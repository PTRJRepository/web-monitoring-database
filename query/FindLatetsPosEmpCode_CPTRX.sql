-- Dapatkan EmpCode dengan PosCode terbaru dari tabel HR_CPTRX
WITH LatestCPID AS (
    SELECT 
        EmpCode,
        MAX(CPID) AS MaxCPID
    FROM 
        [db_ptrj].[dbo].[HR_CPTRX]
    GROUP BY 
        EmpCode
),
EmployeePositions AS (
    SELECT 
        hr.EmpCode,
        hr.Status,
        hr.PosCode
    FROM 
        [db_ptrj].[dbo].[HR_CPTRX] hr
    INNER JOIN 
        LatestCPID lc ON hr.EmpCode = lc.EmpCode AND hr.CPID = lc.MaxCPID
),
-- Tambahkan CTE untuk menangani duplikat
WorkerData AS (
    SELECT 
        f.ID,
        f.TRANSNO,
        f.FROMOCCODE,
        f.TOOCCODE,
        f.WORKERCODE,
        f.FIELDNO,
        f.LOOSEFRUIT,
        f.RIPE,
        f.UNRIPE,
        f.OVERRIPE,
        f.TRANSDATE,
        f.TRANSSTATUS,
        e.Status AS EmployeeStatus,
        e.PosCode,
        ROW_NUMBER() OVER (PARTITION BY f.WORKERCODE ORDER BY f.TRANSDATE DESC) AS RowNum,
        COUNT(*) OVER (PARTITION BY f.WORKERCODE) AS WorkerCount
    FROM 
        [staging_PTRJ_iFES_Plantware].[dbo].[Ffbscannerdata] f
    INNER JOIN 
        EmployeePositions e ON f.WORKERCODE = e.EmpCode
    WHERE 
        f.TRANSDATE >= DATEFROMPARTS(YEAR(GETDATE()), 3, 1) -- Awal bulan Maret tahun ini
        AND f.TRANSDATE < DATEADD(day, 1, CAST(GETDATE() AS date)) -- Sampai dengan hari ini
        AND f.TRANSSTATUS = 'OK'
        AND f.RIPE > 0
        AND e.PosCode != 'HAR'
)
-- Query utama yang hanya mengambil satu baris per WORKERCODE
SELECT 
    ID,
    TRANSNO,
    FROMOCCODE,
    TOOCCODE,
    WORKERCODE,
    FIELDNO,
    LOOSEFRUIT,
    RIPE,
    UNRIPE,
    OVERRIPE,
    TRANSDATE,
    TRANSSTATUS,
    EmployeeStatus,
    PosCode,
    WorkerCount AS JumlahKemunculan -- Menampilkan berapa kali worker muncul
FROM 
    WorkerData
WHERE 
    RowNum = 1 -- Hanya ambil baris pertama untuk setiap WORKERCODE
ORDER BY 
    FROMOCCODE,
    WorkerCount DESC, -- Urutkan berdasarkan jumlah kemunculan (duplikat di atas)
    WORKERCODE