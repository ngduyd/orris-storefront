/** Prices are stored as SAR × 100 (GoldenScent source) and displayed in USD. */
export const SAR_PER_USD = 3.75; // SAR has been pegged to USD since 1986, it is not a floating rate

export const usd = (sarMinor: number) => {
  const v = sarMinor / 100 / SAR_PER_USD;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Source price for the tooltip, so the conversion is transparent. */
export const sarNote = (sarMinor: number) => `SAR ${(sarMinor / 100).toLocaleString("en-US")}`;

/** SAR minor -> USD minor (Stripe charges in cents). */
export const usdMinor = (sarMinor: number) => Math.round(sarMinor / SAR_PER_USD);

/** On sale when the regular price is above the sale price. */
export const onSale = (p: { priceMinor: number; compareAtMinor: number | null }) =>
  p.compareAtMinor !== null && p.compareAtMinor > p.priceMinor;

/** Discount percentage, rounded down. */
export const discountPercent = (p: { priceMinor: number; compareAtMinor: number | null }) =>
  onSale(p) ? Math.floor(((p.compareAtMinor! - p.priceMinor) / p.compareAtMinor!) * 100) : 0;
