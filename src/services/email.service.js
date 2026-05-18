/**
 * email.service.js — Dynamic Email Sending via Custom SMTP or Ethereal
 *
 * Configurable via environment variables (e.g. Mailtrap, Gmail).
 * Automatically falls back to Ethereal and console logging if no credentials are provided
 * or if SMTP connections fail.
 */
const nodemailer = require('nodemailer');

let transporter;
let fallbackMode = false;

/**
 * Initialize SMTP Transporter dynamically.
 */
async function initializeTransporter() {
    // Option 1: Custom SMTP (e.g. Mailtrap, Gmail) via environment variables
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        console.log('📧 Using custom SMTP configuration:', process.env.SMTP_HOST);
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            connectionTimeout: 10000,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        return;
    }

    // Option 2: Fallback to Ethereal (demo account)
    try {
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
            connectionTimeout: 10000,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
    } catch (err) {
        console.warn('⚠️  Could not create Ethereal account:', err.message);
        fallbackMode = true;
    }
}

/**
 * Send an email.
 * Falls back to console logging if SMTP fails.
 */
async function sendEmail({ to, subject, html }) {
    if (!transporter && !fallbackMode) {
        await initializeTransporter();
    }

    if (transporter && !fallbackMode) {
        try {
            const info = await transporter.sendMail({
                from: process.env.SMTP_FROM || '"Auth System" <noreply@authsystem.com>',
                to,
                subject,
                html
            });

            // If using Ethereal, log the preview URL
            if (transporter.options.host.includes('ethereal')) {
                const previewUrl = nodemailer.getTestMessageUrl(info);
                console.log('────────────────────────────────────────');
                console.log(`📧 Email sent to: ${to}`);
                console.log(`   Subject:     ${subject}`);
                console.log(`   Preview URL: ${previewUrl}`);
                console.log('────────────────────────────────────────');
                return previewUrl;
            }

            console.log(`📧 Email successfully sent via SMTP to: ${to}`);
            return true;

        } catch (err) {
            console.warn(`⚠️  SMTP send failed: ${err.message}`);
            console.warn('   Falling back to console logging...');
            fallbackMode = true;
        }
    }

    // ─── FALLBACK: Log email content directly to console ────────
    console.log('');
    console.log('══════════════════════════════════════════════════════════');
    console.log('📧 EMAIL (console fallback — SMTP blocked by host)');
    console.log('──────────────────────────────────────────────────────────');
    console.log(`   To:      ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log('──────────────────────────────────────────────────────────');

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
