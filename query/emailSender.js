const moment = require('moment');
const { emailConfig, transporter } = require('./emailConfig');

// Function to send email notification
async function sendEmailNotification(data, dataType = 'tunjangan_beras') {
    try {
        // Determine email template and recipient based on data type
        let emailSubject, emailBody, emailRecipient;
        
        switch(dataType) {
            case 'bpjs':
                emailSubject = `Monitoring BPJS - ${moment().format('DD-MM-YYYY HH:mm')}`;
                emailBody = 'Ditemukan data BPJS yang belum lengkap. Mohon untuk segera ditindaklanjuti.';
                emailRecipient = emailConfig.queryEmails.bpjs;
                break;
            case 'gwscanner':
                emailSubject = `PENTING: Duplikat GWScanner Terdeteksi - ${moment().format('DD-MM-YYYY HH:mm')}`;
                emailBody = 'Ditemukan data duplikat pada GWScanner. Mohon untuk segera ditindaklanjuti.';
                emailRecipient = emailConfig.queryEmails.gwscanner;
                break;
            case 'ffbworker':
                emailSubject = `PERHATIAN: Pekerja Non-Pemanen dengan Ripe - ${moment().format('DD-MM-YYYY HH:mm')}`;
                emailBody = 'Ditemukan data pekerja dengan posisi bukan pemanen (non-HAR) yang memiliki data Ripe. Mohon untuk segera diverifikasi.';
                emailRecipient = emailConfig.queryEmails.ffbworker;
                break;
            default: // tunjangan_beras
                emailSubject = `Monitoring Tunjangan Beras - ${moment().format('DD-MM-YYYY HH:mm')}`;
                emailBody = emailConfig.emailTemplate;
                emailRecipient = emailConfig.queryEmails.tunjangan_beras;
        }

        // Generate HTML table based on data type
        let htmlTable = generateHtmlTable(data, dataType);

        // Tentukan penerima email berdasarkan flag isFirstEmail
        const emailTo = emailConfig.isFirstEmail ? emailConfig.firstTimeEmail : emailRecipient;
        console.log(`Sending ${dataType} email to: ${emailTo} (First email: ${emailConfig.isFirstEmail})`);

        const mailOptions = {
            from: emailConfig.senderEmail,
            to: emailTo,
            subject: emailSubject,
            html: `
                <h2>${emailSubject}</h2>
                <p>${emailBody}</p>
                <p>Tanggal: ${moment().format('DD-MM-YYYY HH:mm:ss')}</p>
                <p>Jumlah Data: ${data.length}</p>
                ${htmlTable}
            `
        };

        if (emailConfig.ccEmail) {
            mailOptions.cc = emailConfig.ccEmail;
        }

        await transporter.sendMail(mailOptions);
        console.log(`${dataType} email sent successfully`);
        
        // Setelah email pertama terkirim, ubah flag
        if (emailConfig.isFirstEmail) {
            emailConfig.isFirstEmail = false;
            console.log('First email sent, switching to default recipient');
        }
        
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

// Function to generate HTML table based on data type
function generateHtmlTable(data, dataType) {
    switch(dataType) {
        case 'bpjs':
            return `
            <table border="1" style="border-collapse: collapse; width: 100%;">
                <tr style="background-color: #f2f2f2;">
                    <th>EmpCode</th>
                    <th>Nama</th>
                    <th>SalGradeCode</th>
                    <th>JKKNo</th>
                    <th>Status JKKScheme</th>
                    <th>Status JHTScheme</th>
                    <th>Status BPJSScheme</th>
                    <th>Status Keseluruhan</th>
                </tr>
                ${data.map(row => `
                    <tr>
                        <td>${row.EmpCode}</td>
                        <td>${row.EmpName}</td>
                        <td>${row.SalGradeCode}</td>
                        <td>${row.JKKNo || '-'}</td>
                        <td>${row.Status_JKKScheme}</td>
                        <td>${row.Status_JHTScheme}</td>
                        <td>${row.Status_BPJSScheme}</td>
                        <td>${row.StatusKeseluruhan}</td>
                    </tr>
                `).join('')}
            </table>`;

        case 'gwscanner':
            return `
            <table border="1" style="border-collapse: collapse; width: 100%;">
                <tr style="background-color: #f2f2f2;">
                    <th>ID</th>
                    <th>TRANSNO</th>
                    <th>FROMOCCODE</th>
                    <th>TOOCCODE</th>
                    <th>SCANNERUSERCODE</th>
                    <th>WORKERCODE</th>
                    <th>FIELDNO</th>
                    <th>TRANSDATE</th>
                    <th>TRANSSTATUS</th>
                </tr>
                ${data.map(row => `
                    <tr>
                        <td>${row.ID}</td>
                        <td>${row.TRANSNO}</td>
                        <td>${row.FROMOCCODE}</td>
                        <td>${row.TOOCCODE}</td>
                        <td>${row.SCANNERUSERCODE}</td>
                        <td>${row.WORKERCODE}</td>
                        <td>${row.FIELDNO}</td>
                        <td>${row.TRANSDATE ? moment(row.TRANSDATE).format('YYYY-MM-DD') : '-'}</td>
                        <td>${row.TRANSSTATUS}</td>
                    </tr>
                `).join('')}
            </table>`;

        case 'ffbworker':
            return `
            <table border="1" style="border-collapse: collapse; width: 100%;">
                <tr style="background-color: #f2f2f2;">
                    <th>ID</th>
                    <th>TRANSNO</th>
                    <th>FROMOCCODE</th>
                    <th>TOOCCODE</th>
                    <th>WORKERCODE</th>
                    <th>FIELDNO</th>
                    <th>LOOSEFRUIT</th>
                    <th>RIPE</th>
                    <th>UNRIPE</th>
                    <th>OVERRIPE</th>
                    <th>TRANSDATE</th>
                    <th>TRANSSTATUS</th>
                    <th>Status Karyawan</th>
                    <th>Posisi</th>
                    <th>Jumlah Kemunculan</th>
                </tr>
                ${data.map(row => `
                    <tr>
                        <td>${row.ID}</td>
                        <td>${row.TRANSNO}</td>
                        <td>${row.FROMOCCODE}</td>
                        <td>${row.TOOCCODE}</td>
                        <td>${row.WORKERCODE}</td>
                        <td>${row.FIELDNO}</td>
                        <td>${row.LOOSEFRUIT}</td>
                        <td>${row.RIPE}</td>
                        <td>${row.UNRIPE}</td>
                        <td>${row.OVERRIPE}</td>
                        <td>${row.TRANSDATE ? moment(row.TRANSDATE).format('YYYY-MM-DD') : '-'}</td>
                        <td>${row.TRANSSTATUS}</td>
                        <td>${row.EmployeeStatus}</td>
                        <td>${row.PosCode}</td>
                        <td>${row.JumlahKemunculan}</td>
                    </tr>
                `).join('')}
            </table>`;

        default: // tunjangan_beras
            return `
            <table border="1" style="border-collapse: collapse; width: 100%;">
                <tr style="background-color: #f2f2f2;">
                    <th>EmpCode</th>
                    <th>Nama</th>
                    <th>Status Pernikahan</th>
                    <th>Jml Keluarga</th>
                    <th>Rice Aktual</th>
                    <th>Rice Seharusnya</th>
                    <th>Status Tunjangan</th>
                    <th>Selisih</th>
                    <th>Status</th>
                </tr>
                ${data.map(row => `
                    <tr>
                        <td>${row.EmpCode}</td>
                        <td>${row.EmpName}</td>
                        <td>${row.Status_Pernikahan}</td>
                        <td>${row.JmlKeluarga}</td>
                        <td>${row.RiceRation_Aktual}</td>
                        <td>${row.RiceRation_Seharusnya}</td>
                        <td>${row.Status_Tunjangan}</td>
                        <td>${row.Selisih_RiceRation}</td>
                        <td>${row.Perbandingan_RiceRation}</td>
                    </tr>
                `).join('')}
            </table>`;
    }
}

module.exports = {
    sendEmailNotification
}; 