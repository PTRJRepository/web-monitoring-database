// Query untuk monitoring tunjangan beras
const TUNJANGAN_BERAS_QUERY = `
DECLARE @CurrentYear INT = YEAR(GETDATE());

WITH FamilyCTE AS (
    SELECT 
        f1.EmpCode,
        f1.FamName,
        f1.Relationship,
        f1.DOB,
        f1.CeaseRiceInd,
        f1.WorkInd,
        DATEDIFF(YEAR, f1.DOB, DATEFROMPARTS(@CurrentYear, 1, 1)) AS Usia,
        CASE 
            WHEN f1.Relationship = 1 THEN 1  -- Pasangan selalu RN = 1
            ELSE ROW_NUMBER() OVER (PARTITION BY f1.EmpCode, f1.Relationship ORDER BY f1.DOB DESC) +
                 CASE WHEN EXISTS (SELECT 1 FROM [db_ptrj].[dbo].[HR_EMPFAM] f2 
                                  WHERE f2.EmpCode = f1.EmpCode AND f2.Relationship = 1) 
                      THEN 1 ELSE 0 END
        END AS RN
    FROM 
        [db_ptrj].[dbo].[HR_EMPFAM] f1
    WHERE 
        f1.Relationship IN (1, 2)  -- Hanya pasangan dan anak
),
ValidationCTE AS (
    SELECT 
        f.EmpCode,
        f.FamName,
        f.Relationship,
        f.DOB,
        f.CeaseRiceInd,
        f.WorkInd,
        f.Usia,
        f.RN AS AdjustedRN,
        CASE 
            WHEN f.WorkInd = 1 THEN 'Ya'
            ELSE 'Bukan'
        END AS IsEmployee,
        CASE 
            WHEN f.Relationship = 1 AND f.WorkInd = 1 AND f.CeaseRiceInd = 2 THEN 'Salah - Pasangan yang bekerja seharusnya tidak menerima tunjangan'
            WHEN f.Relationship = 2 AND f.RN IN (2, 3) AND f.Usia > 21 AND f.CeaseRiceInd = 2 THEN 'Salah - Usia > 21 tahun seharusnya tidak menerima tunjangan'
            WHEN f.Relationship = 2 AND f.RN IN (2, 3) AND f.Usia <= 21 AND f.CeaseRiceInd = 1 THEN 'Salah - Usia <= 21 tahun seharusnya menerima tunjangan'
            WHEN f.RN IN (4, 5) AND f.CeaseRiceInd = 2 THEN 'Salah - Keluarga ke-4 dan 5 seharusnya tidak menerima tunjangan'
            ELSE 'Benar'
        END AS Status_Validasi,
        f.FamName + 
        CASE f.Relationship
            WHEN 1 THEN ' (S)'  -- Spouse
            WHEN 2 THEN ' (A)'  -- Child
            ELSE ' (L)'         -- Unknown
        END + ' (' + CAST(f.Usia AS VARCHAR(3)) + ' thn)' + 
        ' [' + CASE WHEN f.WorkInd = 1 THEN 'Ya' ELSE 'Bukan' END + ']' AS NamaLengkap,
        CASE f.CeaseRiceInd
            WHEN 1 THEN 'Tidak Menerima'
            WHEN 2 THEN 'Diberikan'
            ELSE 'Tidak Ditentukan'
        END AS Status_Tunjangan_Beras
    FROM 
        FamilyCTE f
)
SELECT 
    f.EmpCode,
    e.EmpName,
    e.Gender,
    CASE e.MaritalStatus
        WHEN 2 THEN 'Menikah'
        WHEN 1 THEN 'Single'
        ELSE 'Cerai'
    END AS Status_Pernikahan,
    COUNT(*) AS JmlKeluarga,
    MAX(CASE WHEN f.AdjustedRN = 1 THEN f.NamaLengkap END) AS Keluarga1,
    MAX(CASE WHEN f.AdjustedRN = 1 THEN f.Status_Tunjangan_Beras END) AS Status_Tunjangan_Beras1,
    MAX(CASE WHEN f.AdjustedRN = 1 THEN f.Status_Validasi END) AS Status_Validasi1,
    MAX(CASE WHEN f.AdjustedRN = 2 THEN f.NamaLengkap END) AS Keluarga2,
    MAX(CASE WHEN f.AdjustedRN = 2 THEN f.Status_Tunjangan_Beras END) AS Status_Tunjangan_Beras2,
    MAX(CASE WHEN f.AdjustedRN = 2 THEN f.Status_Validasi END) AS Status_Validasi2,
    MAX(CASE WHEN f.AdjustedRN = 3 THEN f.NamaLengkap END) AS Keluarga3,
    MAX(CASE WHEN f.AdjustedRN = 3 THEN f.Status_Tunjangan_Beras END) AS Status_Tunjangan_Beras3,
    MAX(CASE WHEN f.AdjustedRN = 3 THEN f.Status_Validasi END) AS Status_Validasi3,
    CAST(p.PayRate AS INT) AS PayRate,
    CAST(p.RiceRation AS INT) AS RiceRation_Aktual,
    CASE 
        WHEN e.MaritalStatus = 3 THEN
            CASE 
                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 'TK/0'
                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 'TK/1'
                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 'TK/2'
                ELSE 'TK/0'
            END
        WHEN e.MaritalStatus = 2 THEN
            CASE
                WHEN e.Gender = 2 THEN 'TK/0'
                WHEN e.Gender = 1 THEN
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM ValidationCTE v 
                                   WHERE v.EmpCode = f.EmpCode 
                                   AND v.Relationship = 1 
                                   AND v.WorkInd = 1) THEN
                            CASE
                                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 'TK/0'
                                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 'TK/1'
                                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 'TK/2'
                                ELSE 'TK/0'
                            END
                        ELSE
                            CASE 
                                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 'K/0'
                                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 'K/1'
                                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 'K/2'
                                ELSE 'K/0'
                            END
                    END
                ELSE 'TK/0'
            END
        ELSE 'TK/0'
    END AS Status_Tunjangan,
    CASE 
        WHEN e.MaritalStatus = 3 THEN
            CASE 
                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 2250
                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 3250
                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 4200
                ELSE 2250
            END
        WHEN e.MaritalStatus = 2 AND e.Gender = 1 THEN
            CASE 
                WHEN EXISTS (SELECT 1 FROM ValidationCTE v 
                           WHERE v.EmpCode = f.EmpCode 
                           AND v.Relationship = 1 
                           AND v.WorkInd = 1) THEN
                    CASE
                        WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 2250
                        WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 3250
                        WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 4200
                        ELSE 2250
                    END
                ELSE
                    CASE 
                        WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 3700
                        WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 4650
                        WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 5550
                        ELSE 3700
                    END
            END
        ELSE 2250
    END AS RiceRation_Seharusnya
FROM ValidationCTE f
JOIN [db_ptrj].[dbo].[HR_EMPLOYEE] e ON f.EmpCode = e.EmpCode
LEFT JOIN [db_ptrj].[dbo].[HR_PAYROLLDETAIL] p ON e.EmpCode = p.EmpCode
GROUP BY 
    f.EmpCode,
    e.EmpName,
    e.Gender,
    e.MaritalStatus,
    p.PayRate,
    p.RiceRation
HAVING 
    MAX(CASE WHEN f.AdjustedRN = 1 THEN f.Status_Validasi END) LIKE 'Salah%'
    OR MAX(CASE WHEN f.AdjustedRN = 2 THEN f.Status_Validasi END) LIKE 'Salah%'
    OR MAX(CASE WHEN f.AdjustedRN = 3 THEN f.Status_Validasi END) LIKE 'Salah%'
    OR MAX(CASE WHEN f.AdjustedRN = 4 THEN f.Status_Validasi END) LIKE 'Salah%'
    OR MAX(CASE WHEN f.AdjustedRN = 5 THEN f.Status_Validasi END) LIKE 'Salah%'
`;

// Query untuk monitoring BPJS
const BPJS_QUERY = `
SELECT 
    s.EmpCode,
    e.EmpName,
    emp.SalGradeCode,
    s.JKKNo,
    CASE WHEN s.JKKScheme IS NULL OR s.JKKScheme = '' THEN 'Belum diisi' ELSE 'Sudah diisi' END AS Status_JKKScheme,
    CASE WHEN s.JHTScheme IS NULL OR s.JHTScheme = '' THEN 'Belum diisi' ELSE 'Sudah diisi' END AS Status_JHTScheme,
    CASE WHEN s.BPJSScheme IS NULL OR s.BPJSScheme = '' THEN 'Belum diisi' ELSE 'Sudah diisi' END AS Status_BPJSScheme,
    CASE 
        WHEN (s.JKKScheme IS NULL OR s.JKKScheme = '') AND (s.JHTScheme IS NULL OR s.JHTScheme = '') AND (s.BPJSScheme IS NULL OR s.BPJSScheme = '') THEN 'Semua skema belum diisi'
        WHEN (s.JKKScheme IS NOT NULL AND s.JKKScheme != '') AND (s.JHTScheme IS NOT NULL AND s.JHTScheme != '') AND (s.BPJSScheme IS NOT NULL AND s.BPJSScheme != '') THEN 'Semua skema sudah diisi'
        ELSE 'Sebagian skema belum diisi'
    END AS StatusKeseluruhan
FROM 
    [db_ptrj].[dbo].[HR_STATUTORY] s
JOIN
    [db_ptrj].[dbo].[HR_EMPLOYEE] e ON s.EmpCode = e.EmpCode
JOIN
    [db_ptrj].[dbo].[HR_EMPLOYMENT] emp ON s.EmpCode = emp.EmpCode
WHERE 
    (s.JKKScheme IS NULL OR s.JKKScheme = '' OR
    s.JHTScheme IS NULL OR s.JHTScheme = '' OR
    s.BPJSScheme IS NULL OR s.BPJSScheme = '')
    AND e.Status = 1
    AND emp.SalGradeCode = 'SKUH'
    AND s.EmpCode NOT LIKE 'CT%'
ORDER BY 
    s.EmpCode
`;

// Query untuk monitoring GWScanner
const GWSCANNER_QUERY = `
WITH DuplicateTransactions AS (
    SELECT 
        ID,
        TRANSNO,
        FROMOCCODE,
        TOOCCODE,
        SCANNERUSERCODE,
        WORKERCODE,
        FIELDNO,
        TRANSDATE,
        TRANSSTATUS,
        COUNT(*) OVER (
            PARTITION BY TRANSNO, FROMOCCODE, TOOCCODE, WORKERCODE, FIELDNO, TRANSDATE
        ) as DuplicateCount
    FROM 
        [db_ptrj].[dbo].[GWScanner_Transaction]
    WHERE 
        TRANSDATE >= DATEFROMPARTS(YEAR(GETDATE()), 3, 1)  -- Dari awal bulan Maret
        AND TRANSDATE <= GETDATE()  -- Sampai sekarang
)
SELECT 
    *
FROM 
    DuplicateTransactions
WHERE 
    DuplicateCount > 1
ORDER BY 
    TRANSNO, TRANSDATE
`;

// Query untuk monitoring FFB Worker
const FFBWORKER_QUERY = `
WITH WorkerTransactions AS (
    SELECT 
        t.ID,
        t.TRANSNO,
        t.FROMOCCODE,
        t.TOOCCODE,
        t.WORKERCODE,
        t.FIELDNO,
        t.LOOSEFRUIT,
        t.RIPE,
        t.UNRIPE,
        t.OVERRIPE,
        t.TRANSDATE,
        t.TRANSSTATUS,
        e.EmpStatus,
        e.PosCode,
        COUNT(*) OVER (
            PARTITION BY t.WORKERCODE
        ) as JumlahKemunculan
    FROM 
        [db_ptrj].[dbo].[GWScanner_Transaction] t
        LEFT JOIN [db_ptrj].[dbo].[HR_EMPLOYEE] e ON t.WORKERCODE = e.EmpCode
    WHERE 
        t.TRANSDATE >= DATEFROMPARTS(YEAR(GETDATE()), 3, 1)  -- Dari awal bulan Maret
        AND t.TRANSDATE <= GETDATE()  -- Sampai sekarang
        AND e.PosCode NOT IN ('HAR')  -- Exclude harvester positions
)
SELECT 
    *
FROM 
    WorkerTransactions
WHERE 
    RIPE > 0  -- Only records with Ripe data
ORDER BY 
    WORKERCODE, TRANSDATE
`;

// Query untuk monitoring sinkronisasi GWScanner dan Overtime
const SYNC_GWSCANNER_OVERTIME_QUERY = `
-- Parameter bulan dan tahun untuk melihat data dari awal Maret hingga sekarang
DECLARE @TargetYear INT = YEAR(GETDATE()); -- Tahun saat ini
DECLARE @StartDate DATE = DATEFROMPARTS(@TargetYear, 3, 1); -- Awal bulan Maret
DECLARE @EndDate DATE = GETDATE(); -- Sampai hari ini

-- Bagian 1: Data yang ada di Overtime tapi tidak ada di GWScanner
SELECT 
    o.WORKERCODE,
    o.TRANSDATE,
    o.TRANSNO,
    o.FROMOCCODE,
    o.TOOCCODE,
    o.TRANSSTATUS,
    e.EmpName,
    e.PosCode,
    'Ada di Overtime tapi tidak ada di GWScanner' AS Status
FROM 
    [staging_PTRJ_iFES_Plantware].[dbo].[Overtime] o
    LEFT JOIN [db_ptrj].[dbo].[HR_EMPLOYEE] e ON o.WORKERCODE = e.EmpCode
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

UNION ALL

-- Bagian 2: Data yang ada di GWScanner tapi tidak ada di Overtime
SELECT 
    g.WORKERCODE,
    g.TRANSDATE,
    g.TRANSNO,
    g.FROMOCCODE,
    g.TOOCCODE,
    g.TRANSSTATUS,
    e.EmpName,
    e.PosCode,
    'Ada di GWScanner tapi tidak ada di Overtime' AS Status
FROM 
    [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata] g
    LEFT JOIN [db_ptrj].[dbo].[HR_EMPLOYEE] e ON g.WORKERCODE = e.EmpCode
WHERE 
    g.TRANSDATE BETWEEN @StartDate AND @EndDate
    AND g.TRANSSTATUS = 'OK'  -- Memastikan hanya data dengan status OK
    AND NOT EXISTS (
        SELECT 1 
        FROM [staging_PTRJ_iFES_Plantware].[dbo].[Overtime] o
        WHERE 
            o.WORKERCODE = g.WORKERCODE
            AND CONVERT(DATE, o.TRANSDATE) = CONVERT(DATE, g.TRANSDATE)
    )

UNION ALL

-- Bagian 3: Data yang ada di kedua tabel tapi memiliki perbedaan pada field penting
SELECT 
    g.WORKERCODE,
    g.TRANSDATE,
    g.TRANSNO,
    g.FROMOCCODE,
    g.TOOCCODE,
    g.TRANSSTATUS,
    e.EmpName,
    e.PosCode,
    'Ada di keduanya tapi tidak sinkron: ' + 
    CASE 
        WHEN g.FROMOCCODE <> o.FROMOCCODE THEN 'FROMOCCODE berbeda'
        WHEN g.TOOCCODE <> o.TOOCCODE THEN 'TOOCCODE berbeda'
        WHEN g.TRANSSTATUS <> o.TRANSSTATUS THEN 'TRANSSTATUS berbeda'
        ELSE 'Field lain berbeda'
    END AS Status
FROM 
    [staging_PTRJ_iFES_Plantware].[dbo].[Gwscannerdata] g
    JOIN [staging_PTRJ_iFES_Plantware].[dbo].[Overtime] o ON 
        g.WORKERCODE = o.WORKERCODE AND 
        CONVERT(DATE, g.TRANSDATE) = CONVERT(DATE, o.TRANSDATE)
    LEFT JOIN [db_ptrj].[dbo].[HR_EMPLOYEE] e ON g.WORKERCODE = e.EmpCode
WHERE 
    g.TRANSDATE BETWEEN @StartDate AND @EndDate
    AND (
        g.FROMOCCODE <> o.FROMOCCODE OR
        g.TOOCCODE <> o.TOOCCODE OR
        g.TRANSSTATUS <> o.TRANSSTATUS
    )
ORDER BY 
    WORKERCODE, 
    TRANSDATE,
    Status
`;

module.exports = {
    TUNJANGAN_BERAS_QUERY,
    BPJS_QUERY,
    GWSCANNER_QUERY,
    FFBWORKER_QUERY,
    SYNC_GWSCANNER_OVERTIME_QUERY
}; 