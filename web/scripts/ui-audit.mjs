import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const pages = [
  ["home", "/"],
  ["shop", "/shop"],
  ["shop-accord", "/shop?accord=Charismatic"],
  ["product", "/product/mont-blanc-mont-blanc-explorer-100ml"],
  ["cart", "/cart"],
];

const viewports = [
  ["mobile", { width: 390, height: 844 }],
  ["desktop", { width: 1440, height: 900 }],
];

const browser = await chromium.launch();
const report = [];

for (const [vpName, vp] of viewports) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 120)));
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 120)));

  for (const [name, path] of pages) {
    const res = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
    await page.screenshot({ path: `/tmp/shots/${vpName}-${name}.png`, fullPage: vpName === "desktop" ? false : true });

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflow = doc.scrollWidth - doc.clientWidth;
      const small = [...document.querySelectorAll("a,button,summary")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24);
      }).length;
      const tiny = [...document.querySelectorAll("p,span,a,li,h1,h2,h3,dt,dd")].filter((el) => {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        return el.textContent.trim() && fs < 11;
      }).length;
      const clipped = [...document.querySelectorAll("h1,h2,h3,p,a")].filter((el) => el.scrollWidth > el.clientWidth + 2).length;
      return { overflow, small, tiny, clipped, h: doc.scrollHeight };
    });
    report.push({ vp: vpName, name, status: res?.status(), ...metrics });
  }
  if (errors.length) report.push({ vp: vpName, name: "console-errors", errors: [...new Set(errors)].slice(0, 5) });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 1));
