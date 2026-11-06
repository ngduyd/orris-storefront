import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const HOST = "http://100.86.205.2:3000";
const email = `smtp-${Date.now()}@example.com`;
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const log = (m) => console.log(m);

await p.goto(`${HOST}/account/register`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', email);
await p.fill('input[name="password"]', "matkhau123");
await p.getByRole("button", { name: /create account/i }).click();
await p.waitForURL("**/account", { timeout: 20000 });
log("đăng ký xong: " + email);

await new Promise((r) => setTimeout(r, 1500));
const qp = (raw) =>
  raw
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\r\n/g, "\n");
const inbox = qp(readFileSync("/tmp/smtp-inbox.txt", "utf8"));
const mails = inbox.split("\n===\n").filter(Boolean);
log("mail nhận qua SMTP: " + mails.length);
const verify = mails.find((m) => m.includes("/account/verify?token="));
log("có link verify: " + Boolean(verify));
if (verify) {
  log("From: " + (verify.match(/^From: .*/m) ?? ["?"])[0]);
  log("Subject: " + (verify.match(/^Subject: .*/m) ?? ["?"])[0]);
  const token = verify.match(/verify\?token=([a-f0-9]{64})/)[1];
  await p.goto(`${HOST}/account/verify?token=${token}`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /confirm this address/i }).click();
  await p.waitForURL("**/account?verify=ok", { timeout: 20000 });
  log("verify qua token trong mail SMTP: OK");
}
await b.close();
