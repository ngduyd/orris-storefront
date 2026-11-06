/** Giá lưu trong DB là SAR × 100 (nguồn GoldenScent). Hiển thị quy ra USD. */
export const SAR_PER_USD = 3.75; // SAR pegged to USD từ 1986, không phải tỷ giá thả nổi

export const usd = (sarMinor: number) => {
  const v = sarMinor / 100 / SAR_PER_USD;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Giá gốc để tooltip, minh bạch là số quy đổi. */
export const sarNote = (sarMinor: number) => `SAR ${(sarMinor / 100).toLocaleString("en-US")}`;

/** SAR minor -> USD minor (Stripe tính bằng cent). */
export const usdMinor = (sarMinor: number) => Math.round(sarMinor / SAR_PER_USD);
