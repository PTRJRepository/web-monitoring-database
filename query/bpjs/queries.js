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

module.exports = {
    BPJS_QUERY
}; 