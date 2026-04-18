import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const mailFrom = process.env.MAIL_FROM || smtpUser;

if (!smtpHost || !smtpUser || !smtpPass) {
  // eslint-disable-next-line no-console
  console.warn('[mailer] SMTP configuration is incomplete. Emails will fail until env is set.');
}

export const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

export type SendMailOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html: string;
  cc?: string | string[];
  /**
   * Optional attachments for this email.
   * We pass these through to Nodemailer as-is.
   */
  attachments?: { filename: string; path: string }[];
};

export async function sendMail(options: SendMailOptions) {
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('SMTP configuration missing. Please set SMTP_HOST, SMTP_USER, SMTP_PASS.');
  }

  const msg: nodemailer.SendMailOptions = {
    from: mailFrom,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    ...(options.attachments && options.attachments.length
      ? { attachments: options.attachments }
      : {}),
  };
  if (options.cc && (Array.isArray(options.cc) ? options.cc.length : options.cc)) {
    msg.cc = options.cc;
  }

  const info = await transporter.sendMail(msg);
  return info;
}