const schedule = require('node-schedule');
const moment = require('moment');
const { emailConfig } = require('./emailConfig');
const { sendEmailNotification } = require('./emailSender');

let monitoringJob = null;
let emailJob = null;

// Function to update schedule
function updateSchedule(intervalMinutes, checkDataCallback) {
    if (monitoringJob) {
        monitoringJob.cancel();
    }
    if (emailJob) {
        emailJob.cancel();
    }

    console.log(`Setting up new schedules: check every ${intervalMinutes} minutes, email every ${emailConfig.emailInterval} minutes`);

    // Schedule for checking data
    monitoringJob = schedule.scheduleJob(`*/${intervalMinutes} * * * *`, async () => {
        try {
            const data = await checkDataCallback();
            console.log(`Scheduled check completed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
            console.log(`Total records: ${data.length}`);
        } catch (err) {
            console.error('Scheduled check failed:', err);
        }
    });

    // Schedule for sending email
    emailJob = schedule.scheduleJob(`*/${emailConfig.emailInterval} * * * *`, async () => {
        try {
            const data = await checkDataCallback();
            if (data && data.length > 0) {
                await sendEmailNotification(data);
                console.log(`Scheduled email sent at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
            } else {
                console.log('No data to send in email');
            }
        } catch (err) {
            console.error('Scheduled email failed:', err);
        }
    });

    // Send first email when application starts
    if (emailConfig.isFirstEmail) {
        setTimeout(async () => {
            try {
                const data = await checkDataCallback();
                if (data && data.length > 0) {
                    await sendEmailNotification(data);
                    console.log(`First email sent at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
                } else {
                    console.log('No data to send in first email');
                    emailConfig.isFirstEmail = false; // Reset flag if no data
                }
            } catch (err) {
                console.error('First email failed:', err);
            }
        }, 10000); // Wait 10 seconds after application starts
    }
}

// Function to send test email
async function sendTestEmail(data) {
    try {
        await sendEmailNotification(data, 'test');
        return { success: true, message: 'Test email sent successfully' };
    } catch (error) {
        console.error('Error sending test email:', error);
        return { success: false, error: error.message };
    }
}

// Function to send current data immediately
async function sendCurrentData(data, dataType) {
    try {
        await sendEmailNotification(data, dataType);
        return { success: true, message: 'Current data sent successfully' };
    } catch (error) {
        console.error('Error sending current data:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    updateSchedule,
    sendTestEmail,
    sendCurrentData
}; 