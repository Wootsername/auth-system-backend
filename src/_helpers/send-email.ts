import nodemailer from 'nodemailer';

export default async function sendEmail({ to, subject, html, from }: any) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    await transporter.sendMail({
        from: from || process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html
    });
}
