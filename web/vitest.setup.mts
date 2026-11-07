import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// next loads .env.local; vitest does not, so load it by hand (no extra dependency).
// CI has no .env.local: the workflow passes the same variables through the environment.
const file = resolve(import.meta.dirname, ".env.local");
if (existsSync(file)) {
  // split(/\r?\n/) so a CRLF file does not swallow every line
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
