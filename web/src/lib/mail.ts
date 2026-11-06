import nodemailer, { type Transporter } from "nodemailer";

/**
 * SMTP thuần, nên dùng được Resend / Postmark / SES / Gmail app-password / Mailtrap...
 * Env (một trong hai kiểu):
 *   SMTP_URL=smtps://user:pass@smtp.example.com:465
 *   hoặc SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE
 * Chưa cấu hình thì in ra console để dev vẫn copy được link xác thực / đặt lại mật khẩu.
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

  // timeout ngắn: SMTP sai cấu hình không được treo request đăng ký
  const timeouts = { connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000 };

  if (url) {
    // smtps://user:pass@host:465 -> object; dùng URL form nên không truyền được options rời
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
    console.log(`\n--- mail (chưa cấu hình SMTP) ---\nTo: ${to}\nFrom: ${from}\nSubject: ${subject}\n\n${text}\n---\n`);
    return;
  }

  try {
    await tx.sendMail({ from, to, subject, text });
  } catch (e) {
    console.error("gửi mail lỗi:", e instanceof Error ? e.message : e);
  }
}
