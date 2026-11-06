import { chromium } from "playwright";
const HOST = process.argv[2] ?? "http://100.86.205.2:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
const p = await ctx.newPage();
const out = [];
p.on("pageerror", (e) => out.push("pageerror: " + e.message.slice(0, 160)));
p.on("console", (m) => { if (m.type() === "error") out.push("console: " + m.text().slice(0, 160)); });
const path = "/product/mont-blanc-mont-blanc-explorer-100ml";

await p.goto(HOST + path, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /add to bag/i }).click();
await p.waitForTimeout(2500);
await p.waitForLoadState("networkidle");
out.push("sau add -> " + new URL(p.url()).pathname);
out.push("cookies: " + (await ctx.cookies()).map((c) => c.name + "@" + c.domain).join(", "));
out.push("cart items hiển thị: " + (await p.locator("li").count()));

const r = await p.goto(HOST + "/checkout", { waitUntil: "networkidle" });
out.push("/checkout status " + r.status() + " -> " + new URL(p.url()).pathname);
out.push("h1: " + (await p.locator("h1").first().textContent().catch(() => "none")));
console.log(out.join("\n"));
await b.close();
