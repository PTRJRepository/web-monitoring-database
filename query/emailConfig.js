const nodemailer = require('nodemailer');

// Email configuration
const emailConfig = {
    senderEmail: 'atharizki.developer@gmail.com',
    receiverEmail: 'hrd@rebinmas.com',
    firstTimeEmail: 'atharizki001@gmail.com',
    ccEmail: '',
    scheduleInterval: 5, // Check every 5 minutes
    emailInterval: 180, // Send email every 3 hours (180 minutes)
    emailTemplate: 'Ditemukan ketidaksesuaian pada data tunjangan beras karyawan. Mohon untuk segera ditindaklanjuti.',
    isFirstEmail: true, // Flag untuk email pertama
    // Email untuk setiap jenis query
    queryEmails: {
        tunjangan_beras: 'hrd@rebinmas.com',
        bpjs: 'bpjs@rebinmas.com',
        gwscanner: 'it@rebinmas.com',
        ffbworker: 'estate@rebinmas.com'
    }
};

// Create email transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: emailConfig.senderEmail,
        pass: 'fxjioeubpjfruasy'
    }
});

module.exports = {
    emailConfig,
    transporter
}; 