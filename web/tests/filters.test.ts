import { describe, expect, it } from "vitest";
import { parseFilters, shopHref, toggle } from "@/lib/filters";

describe("parseFilters", () => {
  it("đọc gender, size, sort", () => {
    const f = parseFilters({ gender: "Women", size: "100", sort: "price_asc" });
    expect(f.gender).toBe("Women");
    expect(f.size).toEqual([100]);
    expect(f.sort).toBe("price_asc");
  });

  it("bỏ giá trị rác, không throw", () => {
    const f = parseFilters({ gender: "Bakhoor", size: "abc", sort: "nope", page: "0" });
    expect(f.gender).toBeUndefined();
    expect(f.size).toBeUndefined();
    expect(f.sort).toBe("rating");
    expect(f.page).toBe(1);
  });

  it("nhận mảng và chuỗi phân cách phẩy", () => {
    expect(parseFilters({ family: ["Woody", "Oriental"] }).family).toEqual(["Woody", "Oriental"]);
    expect(parseFilters({ size: "50,100" }).size).toEqual([50, 100]);
  });

  it("q quá dài bị bỏ", () => {
    expect(parseFilters({ q: "x".repeat(61) }).q).toBeUndefined();
  });
});

describe("shopHref", () => {
  it("bỏ sort mặc định và page 1", () => {
    expect(shopHref({ sort: "rating", page: 1 })).toBe("/shop");
  });

  it("giữ filter cũ khi đổi trang", () => {
    expect(shopHref({ gender: "Men", size: [100], sort: "rating" }, { page: 2 })).toBe(
      "/shop?gender=Men&size=100&page=2",
    );
  });
});

describe("toggle", () => {
  it("bật rồi tắt", () => {
    expect(toggle<number>(undefined, 50)).toEqual([50]);
    expect(toggle<number>([50, 100], 50)).toEqual([100]);
  });
});

describe("accord trong URL", () => {
  it("parse và build href giữ accord", () => {
    const f = parseFilters({ accord: "Charismatic" });
    expect(f.accord).toBe("Charismatic");
    expect(shopHref(f, { page: 2 })).toBe("/shop?accord=Charismatic&page=2");
  });
});
