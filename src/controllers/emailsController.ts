import { Request, Response } from 'express';
import nodemailer from 'nodemailer';

function hasSmtpConfig() {
  return !!(process.env.MAIL_HOST && process.env.MAIL_USER && (process.env.MAIL_PASSWORD || process.env.MAIL_PASS));
}

export const emailsController = {
  async sendEmail(req: Request, res: Response) {
    try {
      const {
        from,
        to,
        cc,
        bcc,
        subject,
        html,
        reply_to,
        attachments,
      } = req.body;

      if (!to || !subject || !html) {
        return res.status(400).json({ message: 'Campos obrigatórios ausentes: to, subject, html' });
      }

      const normalizedTo = Array.isArray(to) ? to : [ to ];

      const normalizedAttachments = Array.isArray(attachments)
        ? attachments.map((a: any) => ({
          filename: a.filename,
          content: Buffer.from(a.content, 'base64'),
        }))
        : undefined;

      if (hasSmtpConfig()) {
        try {
          const host = String(process.env.MAIL_HOST || 'mail.optgrupo.com').trim();
          const port = parseInt(process.env.MAIL_PORT || '587', 10);
          const secure = String(process.env.MAIL_SECURE || (port === 465 ? 'true' : 'false')).toLowerCase() === 'true';
          const user = String(process.env.MAIL_USER).trim();
          const pass = String(process.env.MAIL_PASSWORD || process.env.MAIL_PASS).trim();
          const authMethod = String(process.env.MAIL_AUTH_METHOD || 'LOGIN');
          const requireTLS = !secure;
          const debug = String(process.env.MAIL_DEBUG || 'false').toLowerCase() === 'true';
          const defaultFromName = process.env.MAIL_FROM_NAME || 'HabeasDesk';
          const defaultFromEmail = process.env.MAIL_FROM_EMAIL || user;
          const fromHeader = from || `${defaultFromName} <${defaultFromEmail}>`;

          const primaryOptions = {
            host,
            port,
            name: 'www.optgrupo.com',
            secure,
            auth: { user, pass },
            authMethod,
            requireTLS,
            tls: { rejectUnauthorized: false },
            logger: debug,
          };
          const fallbackPort = port === 587 ? 465 : 587;
          const fallbackSecure = fallbackPort === 465;
          const fallbackOptions = {
            host,
            name: 'www.optgrupo.com',
            port: fallbackPort,
            secure: fallbackSecure,
            auth: { user, pass },
            authMethod,
            requireTLS: !fallbackSecure,
            tls: { rejectUnauthorized: false },
            logger: debug,
          };
          let info;
          try {
            const transporter = nodemailer.createTransport(primaryOptions);
            info = await transporter.sendMail({
              from: fromHeader,
              to: normalizedTo.join(','),
              cc,
              bcc,
              subject,
              html,
              replyTo: reply_to,
              attachments: normalizedAttachments,
            });
          } catch (errPrimary: any) {
            const msg = String(errPrimary?.message || '');
            const code = String(errPrimary?.code || '');
            const shouldRetry = code === 'EAUTH' || msg.includes('535') || msg.toLowerCase().includes('authentication');
            if (!shouldRetry) {
              throw errPrimary;
            }
            const transporterFallback = nodemailer.createTransport(fallbackOptions);
            info = await transporterFallback.sendMail({
              from: fromHeader,
              to: normalizedTo.join(','),
              cc,
              bcc,
              subject,
              html,
              replyTo: reply_to,
              attachments: normalizedAttachments,
            });
          }
          return res.json({ ok: true, id: info.messageId });
        } catch (err: any) {
          return res.status(500).json({ message: err?.message || 'Falha ao enviar email via SMTP' });
        }
      }

      return res.status(500).json({ message: 'Serviço de email não configurado' });
    } catch (error: any) {
      return res.status(500).json({
        message: error?.message || 'Falha ao enviar email',
      });
    }
  },
};
