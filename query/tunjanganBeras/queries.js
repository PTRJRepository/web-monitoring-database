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
        END AS Status_Validasi
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
    CAST(p.RiceRation AS INT) AS RiceRation_Aktual,
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
    p.RiceRation
HAVING 
    MAX(CASE WHEN f.AdjustedRN = 1 THEN f.Status_Validasi END) LIKE 'Salah%'
    OR MAX(CASE WHEN f.AdjustedRN = 2 THEN f.Status_Validasi END) LIKE 'Salah%'
    OR MAX(CASE WHEN f.AdjustedRN = 3 THEN f.Status_Validasi END) LIKE 'Salah%'
`;

module.exports = {
    TUNJANGAN_BERAS_QUERY
}; 