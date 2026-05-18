/**
 * email.service.js — Email Sending via Nodemailer + Ethereal
 *
 * Uses Ethereal (fake SMTP) for demo purposes.
 * Automatically creates a test account on first use.
 * Logs the preview URL to the console so you can view "sent" emails.
 *
 * FALLBACK: If SMTP connection fails (e.g. Render blocks port 587),
 * the email content is logged directly to the console instead.
 */
const nodemailer = require('nodemailer');

let transporter;
let etherealFailed = false;

/**
 * Create an Ethereal test account and configure the transporter.
 * Called automatically on first email send.
 */
async function initializeTransporter() {
    try {
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
            secure: false,
            connectionTimeout: 10000,   // 10 second timeout (fail fast)
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
    } catch (err) {
        console.warn('⚠️  Could not create Ethereal account:', err.message);
        etherealFailed = true;
    }
}

/**
 * Send an email using Ethereal.
 * Falls back to console logging if SMTP is blocked (e.g. on Render free tier).
 *
 * @param {Object} options - { to, subject, html }
 * @returns {string|null} Preview URL (or null if fallback was used)
 */
async function sendEmail({ to, subject, html }) {
    // Initialize transporter on first use
    if (!transporter && !etherealFailed) {
        await initializeTransporter();
    }

    // Try sending via Ethereal SMTP
    if (transporter && !etherealFailed) {
        try {
            const info = await transporter.sendMail({
                from: '"Auth System" <noreply@authsystem.com>',
                to,
                subject,
                html
            });

            const previewUrl = nodemailer.getTestMessageUrl(info);

            console.log('────────────────────────────────────────');
            console.log(`📧 Email sent to: ${to}`);
            console.log(`   Subject:     ${subject}`);
            console.log(`   Preview URL: ${previewUrl}`);
            console.log('────────────────────────────────────────');

            return previewUrl;

        } catch (err) {
            console.warn(`⚠️  SMTP send failed: ${err.message}`);
            console.warn('   Falling back to console logging...');
            etherealFailed = true;
        }
    }

    // ─── FALLBACK: Log email content directly to console ────────
    // This happens when Render blocks outbound SMTP (port 587)
    console.log('');
    console.log('══════════════════════════════════════════════════════════');
    console.log('📧 EMAIL (console fallback — SMTP blocked by host)');
    console.log('──────────────────────────────────────────────────────────');
    console.log(`   To:      ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log('──────────────────────────────────────────────────────────');

    // Extract any URLs from the HTML for easy copy-paste
    const urlMatches = html.match(/https?:\/\/[^\s<"]+/g);
    if (urlMatches) {
        console.log('   🔗 Links found in email:');
        urlMatches.forEach(url => console.log(`      ${url}`));
    }

    console.log('══════════════════════════════════════════════════════════');
    console.log('');

    return null;
}

module.exports = { sendEmail };
