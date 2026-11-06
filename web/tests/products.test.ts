import { describe, expect, it } from "vitest";
import { getFacets, getProduct, listProducts } from "@/lib/products";

describe("getProduct", () => {
  it("trả đủ trường cho handle có thật", async () => {
    const p = await getProduct("givenchy-givenchy-l-interdit-50ml");
    expect(p?.brand).toBe("Givenchy");
    expect(p?.sizeMl).toBe(50);
    expect(Array.isArray(p?.notes.base)).toBe(true);
    expect(p!.priceMinor).toBeGreaterThan(0);
  });

  it("trả null cho handle không tồn tại", async () => {
    expect(await getProduct("khong-ton-tai-9999")).toBeNull();
  });
});

describe("listProducts", () => {
  it("lọc gender + limit", async () => {
    const r = await listProducts({ gender: "Women", limit: 5 });
    expect(r.items).toHaveLength(5);
    expect(r.items.every((p) => p.gender === "Women")).toBe(true);
    expect(r.total).toBeGreaterThan(1000);
  });

  it("sắp theo giá tăng dần", async () => {
    const r = await listProducts({ sort: "price_asc", limit: 10 });
    const prices = r.items.map((p) => p.priceMinor);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("search theo tên", async () => {
    const r = await listProducts({ q: "sauvage", limit: 5 });
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((p) => /sauvage/i.test(`${p.title} ${p.brand}`))).toBe(true);
  });

  it("page 2 khác page 1", async () => {
    const [a, b] = await Promise.all([
      listProducts({ gender: "Men", limit: 5, page: 1 }),
      listProducts({ gender: "Men", limit: 5, page: 2 }),
    ]);
    expect(a.items[0].handle).not.toBe(b.items[0].handle);
  });
});

describe("getFacets", () => {
  it("đếm đủ 3 gender, tổng = 2986", async () => {
    const f = await getFacets();
    const total = f.byGender.reduce((s, x) => s + x.n, 0);
    expect(total).toBe(2986);
    expect(f.byGender.map((x) => x.v).sort()).toEqual(["Men", "Unisex", "Women"]);
  });
});

describe("edge cases", () => {
  it("không filter -> trả trang đầu của toàn catalog", async () => {
    const r = await listProducts({});
    expect(r.items).toHaveLength(24);
    expect(r.total).toBe(2986);
    expect(r.pages).toBe(Math.ceil(2986 / 24));
  });

  it("page vượt trang cuối -> rỗng, không throw", async () => {
    const r = await listProducts({ page: 9999 });
    expect(r.items).toHaveLength(0);
    expect(r.total).toBe(2986);
  });

  it("q chứa % hoặc _ không được coi là wildcard", async () => {
    const pct = await listProducts({ q: "%" });
    expect(pct.total).toBe(0);
    const underscore = await listProducts({ q: "_" });
    expect(underscore.total).toBe(0);
  });

  it("size trùng lặp không nhân đôi kết quả", async () => {
    const [once, twice] = await Promise.all([
      listProducts({ size: [50], limit: 60 }),
      listProducts({ size: [50, 50], limit: 60 }),
    ]);
    expect(twice.total).toBe(once.total);
  });

  it("sort rating: SKU không có rating nằm cuối", async () => {
    const r = await listProducts({ sort: "rating", limit: 5 });
    expect(r.items.every((p) => (p.ratingCount ?? 0) > 0)).toBe(true);
  });

  it("brand filter không phân biệt hoa thường", async () => {
    const lower = await listProducts({ brand: "dior" });
    expect(lower.total).toBeGreaterThan(0);
  });
});

describe("filter accord", () => {
  it("chỉ trả sản phẩm có accord đó", async () => {
    const r = await listProducts({ accord: "Charismatic", limit: 10 });
    expect(r.total).toBeGreaterThan(50);
    expect(r.items.every((p) => p.accords.includes("Charismatic"))).toBe(true);
  });

  it("accord không tồn tại -> 0", async () => {
    expect((await listProducts({ accord: "KhongCoAccordNay" })).total).toBe(0);
  });
});
