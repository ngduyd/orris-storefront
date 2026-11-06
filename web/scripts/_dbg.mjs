import { chromium } from "playwright";
const HOST = "http://100.86.205.2:3000";
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
p.on("console", (m) => console.log("console." + m.type() + ": " + m.text().slice(0, 200)));
p.on("pageerror", (e) => console.log("pageerror: " + e.message.slice(0, 200)));
p.on("response", (r) => {
  if (r.request().method() === "POST" || r.status() >= 400) console.log("net " + r.status() + " " + r.request().method() + " " + r.url().slice(0, 90));
});
await p.goto(`${HOST}/account/register`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', `dbg-${Date.now()}@example.com`);
await p.fill('input[name="password"]', "matkhau123");
await p.getByRole("button", { name: /create account/i }).click();
await p.waitForTimeout(5000);
console.log("url: " + p.url());
await b.close();
