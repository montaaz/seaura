import nodemailer from 'nodemailer';
import { query } from './db';

/**
 * Resolves SMTP configuration from the settings table, falling back to env.
 * Shared by sendEmail and verifySmtp so a successful connection test always
 * reflects the credentials real sends will use.
 */
async function resolveSmtpConfig(fromName?: string) {
    const settingsRes = await query("SELECT key, value FROM settings WHERE key LIKE 'SMTP_%'");
    const dbSettings: Record<string, string> = {};
    settingsRes.rows.forEach((row: any) => {
        dbSettings[row.key] = row.value;
    });

    const SMTP_HOST = (dbSettings['SMTP_HOST'] || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const SMTP_PORT = (dbSettings['SMTP_PORT'] || process.env.SMTP_PORT || '587').trim();
    const SMTP_USER = (dbSettings['SMTP_USER'] || process.env.SMTP_USER || '').trim();
    // Gmail displays App Passwords as "xxxx xxxx xxxx xxxx" but rejects them
    // unless the spaces are removed, so strip all whitespace rather than making
    // every admin remember to.
    const SMTP_PASS = (dbSettings['SMTP_PASS'] || process.env.SMTP_PASS || '').replace(/\s+/g, '');
    const SMTP_SECURE = dbSettings['SMTP_SECURE'] === 'true' || process.env.SMTP_SECURE === 'true';
    const SMTP_FROM_NAME = dbSettings['SMTP_FROM_NAME'] || fromName || 'Boutique Seaura';

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        console.error('Missing SMTP configuration. Check settings table or .env variables: SMTP_HOST, SMTP_USER, SMTP_PASS');
        throw new Error('SMTP non configuré. Veuillez renseigner les paramètres SMTP dans l\'administration.');
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT),
        secure: SMTP_SECURE,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    return { transporter, SMTP_HOST, SMTP_USER, SMTP_FROM_NAME };
}

/** Turns an opaque SMTP auth failure into instructions the admin can act on. */
function describeSmtpError(error: any, host: string, user: string) {
    if (error?.responseCode === 535 || /5\.7\.8|BadCredentials|Invalid login/i.test(error?.message || '')) {
        return new Error(
            `Identifiants SMTP refusés par ${host} pour ${user}. ` +
            `Avec Gmail, un mot de passe d'application est obligatoire (le mot de passe du compte ne fonctionne pas) : ` +
            `activez la validation en deux étapes, puis créez un mot de passe d'application sur ` +
            `https://myaccount.google.com/apppasswords et collez-le dans Paramètres > SMTP.`
        );
    }
    return error;
}

/** Checks the stored credentials against the server without sending a message. */
export async function verifySmtp() {
    const { transporter, SMTP_HOST, SMTP_USER } = await resolveSmtpConfig();
    try {
        await transporter.verify();
        return `Connexion réussie à ${SMTP_HOST} en tant que ${SMTP_USER}.`;
    } catch (error: any) {
        console.error('SMTP verify failed:', error);
        throw describeSmtpError(error, SMTP_HOST, SMTP_USER);
    }
}

/** Escapes user/admin-supplied text before it goes into the HTML part. */
function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function sendEmail({ from, to, subject, content, images, unsubscribeEmail }: { from: string, to: string[], subject: string, content: string, images: string[], unsubscribeEmail?: string }) {
    const { transporter, SMTP_HOST, SMTP_USER, SMTP_FROM_NAME } = await resolveSmtpConfig(from);

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

    const siteUrl = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    // Mailto unsubscribe works without a public site; the URL form is added only
    // when the site is actually reachable (not localhost).
    const isPublicSite = /^https?:\/\//.test(siteUrl) && !/localhost|127\.0\.0\.1/.test(siteUrl);

    const unsubMailto = `<mailto:${SMTP_USER}?subject=Unsubscribe>`;
    const unsubUrl = isPublicSite && unsubscribeEmail
        ? `, <${siteUrl}/unsubscribe?email=${encodeURIComponent(unsubscribeEmail)}>`
        : '';

    const mailOptions = {
        from: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
        // Always address the recipient explicitly in To:. A message with no To:
        // header (BCC-only) is filed away from the inbox by Gmail and often
        // scored as bulk. Callers send one message per recipient, so this never
        // exposes one customer's address to another.
        to: to.join(', '),
        replyTo: SMTP_USER,
        subject: subject,
        // A plain-text part alongside the HTML markedly improves deliverability;
        // HTML-only messages score worse with spam filters.
        text: `${content}\n\n---\nPour ne plus recevoir ces e-mails, répondez avec pour objet "Unsubscribe".`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>
                ${attachments.length > 0 ? '<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">' : ''}
                <p style="font-size:12px;color:#888;margin-top:24px;border-top:1px solid #eee;padding-top:12px;">
                    ${escapeHtml(SMTP_FROM_NAME)}${isPublicSite ? ` — <a href="${siteUrl}" style="color:#888;">${siteUrl}</a>` : ''}<br>
                    Pour ne plus recevoir ces e-mails, répondez à ce message avec pour objet «&nbsp;Unsubscribe&nbsp;».
                </p>
            </div>
        `,
        headers: {
            // Tells Gmail/Outlook this is bulk mail with a genuine opt-out, which
            // is what they look for before showing the one-click unsubscribe.
            'List-Unsubscribe': `${unsubMailto}${unsubUrl}`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        attachments
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return info;
    } catch (error: any) {
        console.error('Nodemailer Error:', error);
        // Gmail's 535 is opaque ("Username and Password not accepted"), so
        // surface what actually needs doing instead of the raw SMTP reply.
        throw describeSmtpError(error, SMTP_HOST, SMTP_USER);
    }
}
