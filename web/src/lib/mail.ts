import nodemailer, { type Transporter } from "nodemailer";

/**
 * Plain SMTP, so Resend / Postmark / SES / Gmail app password / Mailtrap all work.
 * Env (một trong hai kiểu):
 *   SMTP_URL=smtps://user:pass@smtp.example.com:465
 *   hoặc SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE
 * When unconfigured it prints to the console so devs can still copy verify / reset links.
 */
let transport: Transporter | null | undefined;

function getTransport() {
  if (transport !== undefined) return transport;

  const url = process.env.SMTP_URL;
  const host = process.env.SMTP_HOST;
  if (!url && !host) {
    transport = null;
    return transport;
  }

  // short timeouts: a misconfigured SMTP must not hang signup
  const timeouts = { connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000 };

  if (url) {
    // smtps://user:pass@host:465 -> object; the URL form cannot take separate options
    const u = new URL(url);
    transport = nodemailer.createTransport({
      host: u.hostname,
      port: Number(u.port || (u.protocol === "smtps:" ? 465 : 587)),
      secure: u.protocol === "smtps:",
      auth: u.username ? { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password) } : undefined,
      ...timeouts,
    });
  } else {
    transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      ...timeouts,
    });
  }
  return transport;
}

export async function sendMail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const from = process.env.MAIL_FROM ?? "ORRIS <no-reply@orris.local>";
  const tx = getTransport();

  if (!tx) {
    console.log(`\n--- mail (SMTP not configured) ---\nTo: ${to}\nFrom: ${from}\nSubject: ${subject}\n\n${text}\n---\n`);
    return;
  }

  try {
    await tx.sendMail({ from, to, subject, text });
  } catch (e) {
    console.error("sendMail failed:", e instanceof Error ? e.message : e);
  }
}
