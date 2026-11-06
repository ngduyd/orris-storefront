import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// next load .env.local; vitest thì không → nạp tay, không thêm dependency.
// split(/\r?\n/) để không chết trên file CRLF (`.` không match `\r`, nên `.*$` sẽ fail toàn bộ).
for (const line of readFileSync(resolve(import.meta.dirname, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}
