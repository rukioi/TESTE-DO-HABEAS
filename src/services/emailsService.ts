/**
 * Serviço de envio de e-mail (SMTP).
 * Usado pelo webhook Judit, recuperação de senha e controller de e-mails.
 * Compatível com Titan (HostGator): smtp.titan.email, porta 465, SSL.
 */

import nodemailer from 'nodemailer';

function hasSmtpConfig(): boolean {
  return !!(process.env.MAIL_HOST && process.env.MAIL_USER && (process.env.MAIL_PASSWORD || process.env.MAIL_PASS));
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

function createTransporter(port: number, secure: boolean) {
  const host = String(process.env.MAIL_HOST || '').trim();
  const user = String(process.env.MAIL_USER || '').trim();
  const pass = String(process.env.MAIL_PASSWORD || process.env.MAIL_PASS || '').trim();
  const debug = String(process.env.MAIL_DEBUG || 'false').toLowerCase() === 'true';

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure,
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    ...(debug && { logger: true, debug: true }),
  });
}

/**
 * Envia e-mail via SMTP. Usa variáveis de ambiente (MAIL_*).
 * Compatível com Titan: porta 465 (SSL) ou 587 (STARTTLS), com fallback.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ messageId?: string }> {
  const { to, subject, html, from } = options;
  if (!hasSmtpConfig()) throw new Error('Serviço de email não configurado');
  const normalizedTo = Array.isArray(to) ? to : [to];
  if (normalizedTo.length === 0) throw new Error('Destinatário(s) obrigatório(s)');

  const port = parseInt(process.env.MAIL_PORT || '465', 10);
  const secureEnv = process.env.MAIL_SECURE;
  const secure = secureEnv !== undefined
    ? String(secureEnv).toLowerCase() === 'true'
    : port === 465;

  const defaultFromName = process.env.MAIL_FROM_NAME || 'HabeasDesk';
  const defaultFromEmail = process.env.MAIL_FROM_EMAIL || process.env.MAIL_USER || '';
  const fromHeader = from || `${defaultFromName} <${defaultFromEmail}>`;

  const transporter = createTransporter(port, secure);

  try {
    const info = await transporter.sendMail({
      from: fromHeader,
      to: normalizedTo.join(','),
      subject,
      html,
    });
    return { messageId: info.messageId };
  } catch (err: any) {
    const msg = String(err?.message || '');
    const code = String(err?.code || '');
    const isAuthOrConnection = code === 'EAUTH' || msg.includes('535') ||
      msg.toLowerCase().includes('authentication') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT');

    if (isAuthOrConnection && port === 465) {
      // Fallback: Titan pode funcionar melhor com 587 + STARTTLS
      const fallbackPort = 587;
      const fallbackTransporter = createTransporter(fallbackPort, false);
      const info = await fallbackTransporter.sendMail({
        from: fromHeader,
        to: normalizedTo.join(','),
        subject,
        html,
      });
      return { messageId: info.messageId };
    }
    throw err;
  }
}

export const emailsService = { hasSmtpConfig, sendEmail };
