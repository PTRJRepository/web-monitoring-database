DECLARE @CurrentYear INT = YEAR(GETDATE());

-- CTE untuk mengambil data keluarga dan memberikan nomor urut awal
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
-- CTE untuk validasi dan penamaan lengkap
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
),
-- Main query untuk menggabungkan data dan menghitung tunjangan
MainQuery AS (
    SELECT 
        f.EmpCode,
        e.EmpName,
        e.Gender,
        CASE e.MaritalStatus
            WHEN 2 THEN 'Menikah'
            WHEN 1 THEN 'Single'
            ELSE 'Cerai'
        END AS Status_Pernikahan,
        CASE e.Status
            WHEN 1 THEN 'Aktif'
            WHEN 2 THEN 'Tidak Aktif'
            ELSE 'Status Lain'
        END AS Status_Karyawan,
        emp.SalGradeCode,
        p.RiceRationCode,
        COUNT(*) AS JmlKeluarga,
        MAX(CASE WHEN f.AdjustedRN = 1 THEN f.NamaLengkap END) AS Keluarga1,
        MAX(CASE WHEN f.AdjustedRN = 1 THEN f.Usia END) AS Usia1,
        MAX(CASE WHEN f.AdjustedRN = 1 THEN f.Status_Tunjangan_Beras END) AS Status_Tunjangan_Beras1,
        MAX(CASE WHEN f.AdjustedRN = 1 THEN f.IsEmployee END) AS IsEmployee1,
        MAX(CASE WHEN f.AdjustedRN = 1 THEN f.Status_Validasi END) AS Status_Validasi1,
        MAX(CASE WHEN f.AdjustedRN = 2 THEN f.NamaLengkap END) AS Keluarga2,
        MAX(CASE WHEN f.AdjustedRN = 2 THEN f.Usia END) AS Usia2,
        MAX(CASE WHEN f.AdjustedRN = 2 THEN f.Status_Tunjangan_Beras END) AS Status_Tunjangan_Beras2,
        MAX(CASE WHEN f.AdjustedRN = 2 THEN f.IsEmployee END) AS IsEmployee2,
        MAX(CASE WHEN f.AdjustedRN = 2 THEN f.Status_Validasi END) AS Status_Validasi2,
        MAX(CASE WHEN f.AdjustedRN = 3 THEN f.NamaLengkap END) AS Keluarga3,
        MAX(CASE WHEN f.AdjustedRN = 3 THEN f.Usia END) AS Usia3,
        MAX(CASE WHEN f.AdjustedRN = 3 THEN f.Status_Tunjangan_Beras END) AS Status_Tunjangan_Beras3,
        MAX(CASE WHEN f.AdjustedRN = 3 THEN f.IsEmployee END) AS IsEmployee3,
        MAX(CASE WHEN f.AdjustedRN = 3 THEN f.Status_Validasi END) AS Status_Validasi3,
        MAX(CASE WHEN f.AdjustedRN = 4 THEN f.NamaLengkap END) AS Keluarga4,
        MAX(CASE WHEN f.AdjustedRN = 4 THEN f.Usia END) AS Usia4,
        MAX(CASE WHEN f.AdjustedRN = 4 THEN f.Status_Tunjangan_Beras END) AS Status_Tunjangan_Beras4,
        MAX(CASE WHEN f.AdjustedRN = 4 THEN f.IsEmployee END) AS IsEmployee4,
        MAX(CASE WHEN f.AdjustedRN = 4 THEN f.Status_Validasi END) AS Status_Validasi4,
        MAX(CASE WHEN f.AdjustedRN = 5 THEN f.NamaLengkap END) AS Keluarga5,
        MAX(CASE WHEN f.AdjustedRN = 5 THEN f.Usia END) AS Usia5,
        MAX(CASE WHEN f.AdjustedRN = 5 THEN f.Status_Tunjangan_Beras END) AS Status_Tunjangan_Beras5,
        MAX(CASE WHEN f.AdjustedRN = 5 THEN f.IsEmployee END) AS IsEmployee5,
        MAX(CASE WHEN f.AdjustedRN = 5 THEN f.Status_Validasi END) AS Status_Validasi5,
        CAST(p.PayRate AS INT) AS PayRate,
        CAST(p.RiceRation AS INT) AS RiceRation_Aktual,
        CASE 
            -- Status untuk yang cerai
            WHEN e.MaritalStatus = 3 THEN
                CASE 
                    -- Hitung jumlah anak yang bukan karyawan (WorkInd != 1) dan usia <= 21
                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 'TK/0'
                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 'TK/1'
                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 'TK/2'
                    ELSE 'TK/0'
                END
            -- Status untuk yang menikah
            WHEN e.MaritalStatus = 2 THEN
                CASE
                    -- Untuk perempuan yang menikah (Gender = 2)
                    WHEN e.Gender = 2 THEN 'TK/0'
                    -- Untuk laki-laki yang menikah (Gender = 1)
                    WHEN e.Gender = 1 THEN
                        CASE 
                            -- Jika istri adalah karyawan (WorkInd = 1)
                            WHEN EXISTS (SELECT 1 FROM ValidationCTE v 
                                       WHERE v.EmpCode = f.EmpCode 
                                       AND v.Relationship = 1 
                                       AND v.WorkInd = 1) THEN
                                -- Cek jumlah anak yang tidak bekerja dan usia <= 21
                                CASE
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 'TK/0'
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 'TK/1'
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 'TK/2'
                                    ELSE 'TK/0'
                                END
                            -- Jika istri bukan karyawan
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
            -- Tunjangan untuk yang cerai
            WHEN e.MaritalStatus = 3 THEN
                CASE 
                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 2250 -- TK/0
                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 3250 -- TK/1
                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 4200 -- TK/2
                    ELSE 2250
                END
            -- Tunjangan untuk yang menikah
            WHEN e.MaritalStatus = 2 THEN
                CASE
                    -- Untuk perempuan yang menikah (Gender = 2)
                    WHEN e.Gender = 2 THEN 2250
                    -- Untuk laki-laki yang menikah (Gender = 1)
                    WHEN e.Gender = 1 THEN
                        CASE 
                            -- Jika istri adalah karyawan
                            WHEN EXISTS (SELECT 1 FROM ValidationCTE v 
                                       WHERE v.EmpCode = f.EmpCode 
                                       AND v.Relationship = 1 
                                       AND v.WorkInd = 1) THEN
                                -- Cek jumlah anak yang tidak bekerja
                                CASE
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 2250 -- TK/0
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 3250 -- TK/1
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 4200 -- TK/2
                                    ELSE 2250
                                END
                            -- Jika istri bukan karyawan
                            ELSE
                                CASE 
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 3700 -- K/0
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 4650 -- K/1
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 5550 -- K/2
                                    ELSE 3700
                                END
                        END
                    ELSE 2250
                END
            ELSE 2250
        END AS RiceRation_Seharusnya,
        ABS(CAST(p.RiceRation AS INT) - 
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
                        -- Jika istri adalah karyawan
                        WHEN EXISTS (SELECT 1 FROM ValidationCTE v 
                                   WHERE v.EmpCode = f.EmpCode 
                                   AND v.Relationship = 1 
                                   AND v.WorkInd = 1) THEN
                            -- Cek jumlah anak yang tidak bekerja
                            CASE
                                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 2250 -- TK/0
                                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 3250 -- TK/1
                                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 4200 -- TK/2
                                ELSE 2250
                            END
                        -- Jika istri bukan karyawan
                        ELSE
                            CASE 
                                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 3700
                                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 4650
                                WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 5550
                                ELSE 3700
                            END
                    END
                ELSE 2250
            END
        ) AS Selisih_RiceRation,
        CASE 
            WHEN CAST(p.RiceRation AS INT) = 
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
                            -- Jika istri adalah karyawan
                            WHEN EXISTS (SELECT 1 FROM ValidationCTE v 
                                       WHERE v.EmpCode = f.EmpCode 
                                       AND v.Relationship = 1 
                                       AND v.WorkInd = 1) THEN
                                -- Cek jumlah anak yang tidak bekerja
                                CASE
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 2250 -- TK/0
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 3250 -- TK/1
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 4200 -- TK/2
                                    ELSE 2250
                                END
                            -- Jika istri bukan karyawan
                            ELSE
                                CASE 
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 0 THEN 3700
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) = 1 THEN 4650
                                    WHEN COUNT(CASE WHEN f.Relationship = 2 AND f.WorkInd != 1 AND f.Usia <= 21 THEN 1 END) >= 2 THEN 5550
                                    ELSE 3700
                                END
                        END
                    ELSE 2250
                END THEN 'Sama'
            ELSE 'Beda'
        END AS Perbandingan_RiceRation
    FROM 
        ValidationCTE f
    JOIN 
        [db_ptrj].[dbo].[HR_EMPLOYEE] e ON f.EmpCode = e.EmpCode
    LEFT JOIN 
        [db_ptrj].[dbo].[HR_PAYROLL] p ON f.EmpCode = p.EmpCode
    LEFT JOIN
        [db_ptrj].[dbo].[HR_EMPLOYMENT] emp ON f.EmpCode = emp.EmpCode
    WHERE
        e.Status = 1  -- Hanya karyawan aktif
    GROUP BY 
        f.EmpCode, e.EmpName, e.Gender, e.MaritalStatus, e.Status, emp.SalGradeCode, p.RiceRationCode, p.PayRate, p.RiceRation
)
-- Query luar untuk menampilkan data dengan validasi salah atau selisih tunjangan
SELECT *
FROM MainQuery
WHERE 
    ((Status_Validasi1 = 'Salah' OR Status_Validasi2 = 'Salah' OR Status_Validasi3 = 'Salah' OR Status_Validasi4 = 'Salah' OR Status_Validasi5 = 'Salah')
    OR (Perbandingan_RiceRation = 'Beda' AND Selisih_RiceRation > 0))
    AND RiceRation_Aktual < 7000
    AND EXISTS (
        SELECT 1 
        FROM [db_ptrj].[dbo].[HR_EMPLOYMENT] emp 
        WHERE emp.EmpCode = MainQuery.EmpCode 
        AND emp.SalGradeCode = 'SKUH'
    )
    AND (RiceRationCode IS NULL OR RiceRationCode <> 'BERASBHL')
ORDER BY EmpCode; 