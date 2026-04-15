import nodemailer from 'nodemailer';
import { query } from './db';

export async function sendEmail({ from, to, subject, content, images }: { from: string, to: string[], subject: string, content: string, images: string[] }) {
    // Fetch SMTP settings from database
    const settingsRes = await query("SELECT key, value FROM settings WHERE key LIKE 'SMTP_%'");
    const dbSettings: Record<string, string> = {};
    settingsRes.rows.forEach((row: any) => {
        dbSettings[row.key] = row.value;
    });

    const SMTP_HOST = dbSettings['SMTP_HOST'] || process.env.SMTP_HOST || 'smtp.gmail.com';
    const SMTP_PORT = dbSettings['SMTP_PORT'] || process.env.SMTP_PORT || '587';
    const SMTP_USER = dbSettings['SMTP_USER'] || process.env.SMTP_USER;
    const SMTP_PASS = dbSettings['SMTP_PASS'] || process.env.SMTP_PASS;
    const SMTP_SECURE = dbSettings['SMTP_SECURE'] === 'true' || process.env.SMTP_SECURE === 'true';
    const SMTP_FROM_NAME = dbSettings['SMTP_FROM_NAME'] || from || 'Boutique Seaura';

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        console.error('Missing SMTP configuration. Check settings table or .env variables: SMTP_HOST, SMTP_USER, SMTP_PASS');
        throw new Error('SMTP non configuré. Veuillez renseigner les paramètres SMTP dans l\'administration.');
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT),
        secure: SMTP_SECURE,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });

    const attachments = (images || []).map((img, i) => {
        // Extract content and type from base64 data url
        const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
            const contentType = match[1];
            const base64Content = match[2];
            return {
                filename: `image-${i}.${contentType.split('/')[1]}`,
                content: Buffer.from(base64Content, 'base64'),
                contentType
            };
        }
        return null;
    }).filter(Boolean) as any[];

    const mailOptions = {
        from: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
        to: to.join(', '),
        subject: subject,
        text: content,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <p>${content.replace(/\n/g, '<br>')}</p>
                ${attachments.length > 0 ? '<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">' : ''}
            </div>
        `,
        attachments
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('Nodemailer Error:', error);
        throw error;
    }
}
