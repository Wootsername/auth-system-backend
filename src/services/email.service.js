/**
 * email.service.js — Email Sending via Nodemailer + Ethereal
 *
 * Uses Ethereal (fake SMTP) for demo purposes.
 * Automatically creates a test account on first use.
 * Logs the preview URL to the console so you can view "sent" emails.
 */
const nodemailer = require('nodemailer');

let transporter;

/**
 * Create an Ethereal test account and configure the transporter.
 * Called automatically on first email send.
 */
async function initializeTransporter() {
    // nodemailer.createTestAccount() generates a free Ethereal mailbox
    const testAccount = await nodemailer.createTestAccount();

    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('📧 Ethereal Email Test Account Created');
    console.log(`   User:     ${testAccount.user}`);
    console.log(`   Password: ${testAccount.pass}`);
    console.log(`   Web Mail: https://ethereal.email/login`);
    console.log('═══════════════════════════════════════════');
    console.log('');

    transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,   // true for 465, false for other ports
        auth: {
            user: testAccount.user,
            pass: testAccount.pass
        }
    });
}

/**
 * Send an email using Ethereal.
 * @param {Object} options - { to, subject, html }
 * @returns {string} Preview URL where you can view the email
 */
async function sendEmail({ to, subject, html }) {
    // Initialize transporter on first use
    if (!transporter) {
        await initializeTransporter();
    }

    // Send the email
    const info = await transporter.sendMail({
        from: '"Auth System" <noreply@authsystem.com>',
        to,
        subject,
        html
    });

    // Get the Ethereal preview URL (this is how you "read" the email)
    const previewUrl = nodemailer.getTestMessageUrl(info);

    console.log('────────────────────────────────────────');
    console.log(`📧 Email sent to: ${to}`);
    console.log(`   Subject:     ${subject}`);
    console.log(`   Preview URL: ${previewUrl}`);
    console.log('────────────────────────────────────────');

    return previewUrl;
}

module.exports = { sendEmail };
