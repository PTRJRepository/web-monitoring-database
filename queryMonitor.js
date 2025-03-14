const nodemailer = require('nodemailer');
const sql = require('mssql');
require('dotenv').config();

// Email configuration
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'atharizki.developer@gmail.com',
        pass: 'fxjioeubpjfruasy'  // App Password dari konfigurasi yang berhasil
    },
    debug: true // Menambahkan mode debug
});

// SQL Server configuration
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

// Function to check query results
async function checkQueryResults() {
    try {
        await sql.connect(config);
        console.log('Connected to database successfully');
        
        const result = await sql.query(`
            DECLARE @CurrentYear INT = YEAR(GETDATE());

            WITH FamilyCTE AS (
                SELECT 
                    f1.EmpCode,
                    f1.FamName,
                    f1.Relationship,
                    f1.DOB,
                    f1.CeaseRiceInd,
                    DATEDIFF(YEAR, f1.DOB, DATEFROMPARTS(@CurrentYear, 1, 1)) AS Usia,
                    CASE 
                        WHEN f1.Relationship = 1 THEN 1
                        ELSE ROW_NUMBER() OVER (PARTITION BY f1.EmpCode, f1.Relationship ORDER BY f1.DOB ASC) + 
                             CASE WHEN EXISTS (SELECT 1 FROM [dbo].[HR_EMPFAM] f2 
                                              WHERE f2.EmpCode = f1.EmpCode AND f2.Relationship = 1) 
                                  THEN 1 ELSE 0 END
                    END AS RN
                FROM [dbo].[HR_EMPFAM] f1
                WHERE f1.Relationship IN (1, 2)
            ),
            ValidationCTE AS (
                SELECT 
                    f.EmpCode,
                    f.FamName,
                    f.Relationship,
                    f.DOB,
                    f.CeaseRiceInd,
                    f.Usia,
                    f.RN AS AdjustedRN,
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 
                            FROM [dbo].[HR_EMPLOYEE] emp 
                            WHERE (PARSENAME(REPLACE(emp.EmpName, ' (', '.'), 2) = f.FamName 
                                 OR PARSENAME(REPLACE(emp.EmpName, '(', '.'), 2) = f.FamName)
                                AND emp.DOB = f.DOB
                                AND DATEDIFF(YEAR, emp.DOB, DATEFROMPARTS(@CurrentYear, 1, 1)) >= 18
                        ) THEN 'Ya' 
                        ELSE 'Tidak' 
                    END AS IsEmployee,
                    CASE 
                        WHEN f.Relationship = 1 AND EXISTS (
                            SELECT 1 
                            FROM [dbo].[HR_EMPLOYEE] emp 
                            WHERE (PARSENAME(REPLACE(emp.EmpName, ' (', '.'), 2) = f.FamName 
                                 OR PARSENAME(REPLACE(emp.EmpName, '(', '.'), 2) = f.FamName)
                                AND emp.DOB = f.DOB
                                AND DATEDIFF(YEAR, emp.DOB, DATEFROMPARTS(@CurrentYear, 1, 1)) >= 18
                        ) AND f.CeaseRiceInd = 2 THEN 'Salah'
                        WHEN f.Relationship = 2 AND f.RN IN (2, 3) AND f.Usia > 21 AND f.CeaseRiceInd = 2 THEN 'Salah'
                        WHEN f.Relationship = 2 AND f.RN IN (2, 3) AND f.Usia <= 21 AND f.CeaseRiceInd = 1 THEN 'Salah'
                        WHEN f.RN IN (4, 5) AND f.CeaseRiceInd = 2 THEN 'Salah'
                        ELSE 'Benar'
                    END AS Status_Validasi,
                    f.FamName + 
                    CASE f.Relationship
                        WHEN 1 THEN ' (S)'
                        WHEN 2 THEN ' (A)'
                        ELSE ' (L)'
                    END + ' (' + CAST(f.Usia AS VARCHAR(3)) + ' thn)' AS NamaLengkap
                FROM FamilyCTE f
            ),
            MainQuery AS (
                SELECT 
                    f.EmpCode,
                    e.EmpName,
                    CASE e.MaritalStatus
                        WHEN 2 THEN 'Menikah'
                        WHEN 1 THEN 'Single'
                        ELSE 'Cerai'
                    END AS Status_Pernikahan,
                    COUNT(*) AS JmlKeluarga,
                    MAX(CASE WHEN f.AdjustedRN = 1 THEN f.NamaLengkap END) AS Keluarga1,
                    MAX(CASE WHEN f.AdjustedRN = 1 THEN f.Status_Validasi END) AS Status_Validasi1,
                    MAX(CASE WHEN f.AdjustedRN = 2 THEN f.NamaLengkap END) AS Keluarga2,
                    MAX(CASE WHEN f.AdjustedRN = 2 THEN f.Status_Validasi END) AS Status_Validasi2,
                    MAX(CASE WHEN f.AdjustedRN = 3 THEN f.NamaLengkap END) AS Keluarga3,
                    MAX(CASE WHEN f.AdjustedRN = 3 THEN f.Status_Validasi END) AS Status_Validasi3,
                    CAST(p.RiceRation AS INT) AS RiceRation_Aktual,
                    CASE 
                        WHEN e.MaritalStatus = 3 THEN
                            CASE 
                                WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) = 1 THEN 3250
                                WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) = 2 THEN 4200
                                ELSE 0
                            END
                        WHEN e.MaritalStatus = 2 THEN
                            CASE 
                                WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) = 0 THEN 3700
                                WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) = 1 THEN 4650
                                WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) >= 2 THEN 5550
                                ELSE 0
                            END
                        ELSE 0
                    END AS RiceRation_Seharusnya,
                    CASE 
                        WHEN CAST(p.RiceRation AS INT) = 
                            CASE 
                                WHEN e.MaritalStatus = 3 THEN
                                    CASE 
                                        WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) = 1 THEN 3250
                                        WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) = 2 THEN 4200
                                        ELSE 0
                                    END
                                WHEN e.MaritalStatus = 2 THEN
                                    CASE 
                                        WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) = 0 THEN 3700
                                        WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) = 1 THEN 4650
                                        WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) >= 2 THEN 5550
                                        ELSE 0
                                    END
                                ELSE 0
                            END THEN 'Sama'
                        ELSE 'Beda'
                    END AS Perbandingan_RiceRation,
                    ABS(CAST(p.RiceRation AS INT) - 
                        CASE 
                            WHEN e.MaritalStatus = 3 THEN
                                CASE 
                                    WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) = 1 THEN 3250
                                    WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) = 2 THEN 4200
                                    ELSE 0
                                END
                            WHEN e.MaritalStatus = 2 THEN
                                CASE 
                                    WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) = 0 THEN 3700
                                    WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) = 1 THEN 4650
                                    WHEN SUM(CASE WHEN f.Relationship = 2 AND f.Usia <= 21 THEN 1 ELSE 0 END) >= 2 THEN 5550
                                    ELSE 0
                                END
                            ELSE 0
                        END
                    ) AS Selisih_RiceRation
                FROM 
                    ValidationCTE f
                JOIN 
                    [dbo].[HR_EMPLOYEE] e ON f.EmpCode = e.EmpCode
                LEFT JOIN 
                    [dbo].[HR_PAYROLL] p ON f.EmpCode = p.EmpCode
                WHERE
                    e.Status = 1
                GROUP BY 
                    f.EmpCode, e.EmpName, e.MaritalStatus, p.RiceRation
            )
            SELECT *
            FROM MainQuery
            WHERE 
                ((Status_Validasi1 = 'Salah' OR Status_Validasi2 = 'Salah' OR Status_Validasi3 = 'Salah')
                OR (Perbandingan_RiceRation = 'Beda' AND Selisih_RiceRation > 0))
                AND RiceRation_Aktual < 7000 AND Status_Pernikahan != 'Single'
            ORDER BY EmpCode;
        `);

        console.log(`Found ${result.recordset.length} records with discrepancies`);

        if (result.recordset.length > 0) {
            await sendEmailNotification(result.recordset);
        }

        return result.recordset;
    } catch (err) {
        console.error('Error checking query results:', err);
        throw err;
    } finally {
        await sql.close();
    }
}

// Function to send email notification
async function sendEmailNotification(data) {
    const mailOptions = {
        from: 'atharizki.developer@gmail.com',
        to: 'estate_1@rebinmas.com',
        subject: 'Monitoring Tunjangan Beras - Alert Discrepancies',
        html: `
            <h2>Monitoring Tunjangan Beras - Alert</h2>
            <p>Ditemukan ketidaksesuaian pada data berikut:</p>
            <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
                <tr style="background-color: #f2f2f2;">
                    <th>EmpCode</th>
                    <th>Nama</th>
                    <th>Status Pernikahan</th>
                    <th>Jml Keluarga</th>
                    <th>Keluarga 1</th>
                    <th>Status 1</th>
                    <th>Keluarga 2</th>
                    <th>Status 2</th>
                    <th>Keluarga 3</th>
                    <th>Status 3</th>
                    <th>Rice Aktual</th>
                    <th>Rice Seharusnya</th>
                    <th>Status</th>
                    <th>Selisih</th>
                </tr>
                ${data.map(row => `
                    <tr>
                        <td>${row.EmpCode}</td>
                        <td>${row.EmpName}</td>
                        <td>${row.Status_Pernikahan}</td>
                        <td>${row.JmlKeluarga}</td>
                        <td>${row.Keluarga1 || '-'}</td>
                        <td>${row.Status_Validasi1 || '-'}</td>
                        <td>${row.Keluarga2 || '-'}</td>
                        <td>${row.Status_Validasi2 || '-'}</td>
                        <td>${row.Keluarga3 || '-'}</td>
                        <td>${row.Status_Validasi3 || '-'}</td>
                        <td>${row.RiceRation_Aktual}</td>
                        <td>${row.RiceRation_Seharusnya}</td>
                        <td>${row.Perbandingan_RiceRation}</td>
                        <td>${row.Selisih_RiceRation}</td>
                    </tr>
                `).join('')}
            </table>
            <p>Terima kasih.</p>
        `
    };

    try {
        console.log('Attempting to send email...');
        await transporter.sendMail(mailOptions);
        console.log('Email notification sent successfully');
    } catch (error) {
        console.error('Error sending email notification:', error);
        throw error;
    }
}

// Schedule monitoring every 30 minutes
const schedule = require('node-schedule');
schedule.scheduleJob('*/30 * * * *', async function() {
    console.log('Running scheduled check...');
    await checkQueryResults();
});

// Run initial check
console.log('Starting monitoring system...');
checkQueryResults().catch(console.error);

module.exports = {
    checkQueryResults,
    sendEmailNotification
}; 