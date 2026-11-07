import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { clearFailures, noteFailure, tooMany } from "@/lib/rate-limit";

afterEach(() => clearFailures("t:key"));

describe("rate limit", () => {
  it("allows up to the limit, then refuses inside the window", () => {
    for (let i = 0; i < 3; i++) noteFailure("t:key", 60_000);
    expect(tooMany("t:key", 3)).toBe(true);
    expect(tooMany("t:key", 4)).toBe(false);
  });

  it("a different key is unaffected, and clearing forgets the history", () => {
    noteFailure("t:key", 60_000);
    expect(tooMany("t:other", 1)).toBe(false);
    clearFailures("t:key");
    expect(tooMany("t:key", 1)).toBe(false);
  });
});

describe("admin actions are guarded", () => {
  const src = readFileSync("src/actions/admin.ts", "utf8");

  it("every exported action starts by requiring a role", () => {
    const bodies = src.split(/export async function /).slice(1);
    expect(bodies.length).toBeGreaterThan(5);
    const unguarded = bodies
      .map((b) => b.slice(0, b.indexOf("{")) + b.slice(b.indexOf("{"), b.indexOf("{") + 260))
      .filter((b) => !/requireStaff\(|requireManager\(/.test(b));
    expect(unguarded).toEqual([]);
  });

  it("carrier-only endpoints are manager-gated", () => {
    for (const name of ["saveProductAction", "refundOrderAction", "saveUserRoleAction", "renameBrandAction"]) {
      const start = src.indexOf(`export async function ${name}`);
      expect(start).toBeGreaterThan(-1);
      expect(src.slice(start, start + 260)).toMatch(/requireManager\(/);
    }
  });
});

describe("upload endpoint", () => {
  const src = readFileSync("src/app/api/admin/upload/route.ts", "utf8");
  it("checks the session, the count, the mime type and the size before writing", () => {
    expect(src).toMatch(/currentStaff\(\)/);
    expect(src).toMatch(/files\.length > 8/);
    expect(src).toMatch(/image\//);
    expect(src).toMatch(/MAX_BYTES/);
  });
});
