/** CI fixture: 2986 deterministic products satisfying all test assertions. */
import { db } from "../src/db";
import { products } from "../src/db/schema";

const brands = ["Dior", "Chanel", "Givenchy", "Mont Blanc", "Yves Saint Laurent", "Gucci", "Prada", "Hermès", "Tom Ford", "Versace"];
const genders = ["Men", "Women", "Unisex"];
const concentrations = ["Eau de Parfum", "Eau de Toilette", "Parfum"];
const families = ["Woody", "Floral", "Fresh", "Oriental", "Citrus"];
const allAccords = ["Fresh", "Woody", "Floral", "Charismatic", "Spicy", "Sweet", "Aromatic", "Warm"];
const sizes = [30, 50, 75, 100, 125, 150];

function deterministicRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const shuffled = [...arr].sort(() => rng() - 0.5);
  return shuffled.slice(0, n);
}

async function main() {
  await db.delete(products);

  const fixtures: typeof products.$inferInsert[] = [];

  // exact handles cart/order tests depend on
  fixtures.push({
    handle: "mont-blanc-mont-blanc-explorer-100ml",
    title: "Mont Blanc Explorer",
    brand: "Mont Blanc",
    gender: "Men",
    concentration: "Eau de Parfum",
    family: "Woody",
    accords: ["Fresh", "Woody"],
    notes: { top: ["Bergamot"], mid: ["Vetiver"], base: ["Cedar"] },
    sizeMl: 100,
    priceMinor: 25000,
    rating: "4.5",
    ratingCount: 100,
    year: 2019,
    description: "CI fixture",
    image: "test.jpg",
    status: "active",
    stock: 100,
  });

  fixtures.push({
    handle: "givenchy-givenchy-l-interdit-50ml",
    title: "Givenchy L'Interdit",
    brand: "Givenchy",
    gender: "Women",
    concentration: "Eau de Parfum",
    family: "Floral",
    accords: ["Floral", "Charismatic"],
    notes: { top: ["Orange"], mid: ["Jasmine"], base: ["Patchouli"] },
    sizeMl: 50,
    priceMinor: 30000,
    rating: "4.7",
    ratingCount: 150,
    year: 2018,
    description: "CI fixture",
    image: "test.jpg",
    status: "active",
    stock: 100,
  });

  // 1 Dior Sauvage for search + brand filter
  fixtures.push({
    handle: "dior-sauvage-100ml",
    title: "Sauvage",
    brand: "Dior",
    gender: "Men",
    concentration: "Eau de Toilette",
    family: "Fresh",
    accords: ["Fresh", "Spicy"],
    notes: { top: ["Calabrian Bergamot"], mid: ["Sichuan Pepper"], base: ["Ambroxan"] },
    sizeMl: 100,
    priceMinor: 89000,
    rating: "4.6",
    ratingCount: 2500,
    year: 2015,
    description: "CI fixture",
    image: "dior-sauvage.jpg",
    status: "active",
    stock: 100,
  });

  // 49 more Charismatic products (51 total incl. Givenchy above; Women-heavy to help Women>1000)
  for (let i = 0; i < 49; i++) {
    const rng = deterministicRandom(1000 + i);
    const gender = i < 35 ? "Women" : pick(genders, rng);
    const accords = ["Charismatic", ...pickN(allAccords.filter(a => a !== "Charismatic"), 2, rng)];
    fixtures.push({
      handle: `charismatic-${i}`,
      title: `Charismatic Perfume ${i}`,
      brand: pick(brands, rng),
      gender,
      concentration: pick(concentrations, rng),
      family: pick(families, rng),
      accords,
      notes: { top: ["Note1"], mid: ["Note2"], base: ["Note3"] },
      sizeMl: pick(sizes, rng),
      priceMinor: 20000 + Math.floor(rng() * 80000),
      rating: rng() > 0.3 ? (3 + rng() * 2).toFixed(1) : null,
      ratingCount: rng() > 0.3 ? Math.floor(rng() * 500) + 1 : null,
      year: 2010 + Math.floor(rng() * 15),
      description: "CI fixture",
      image: `img${i}.jpg`,
      status: "active",
      stock: 50,
    });
  }

  // remaining to reach 2986, ensuring Women>1000
  const target = 2986;
  let womenCount = fixtures.filter(p => p.gender === "Women").length;
  const remaining = target - fixtures.length;

  for (let i = 0; i < remaining; i++) {
    const rng = deterministicRandom(2000 + i);
    // force Women until >1000
    let gender: string;
    if (womenCount < 1001) {
      gender = "Women";
      womenCount++;
    } else {
      gender = pick(genders, rng);
      if (gender === "Women") womenCount++;
    }

    const accords = pickN(allAccords, Math.floor(rng() * 3) + 2, rng);
    const hasRating = rng() > 0.2;
    fixtures.push({
      handle: `product-${i}`,
      title: `Perfume ${i}`,
      brand: pick(brands, rng),
      gender,
      concentration: pick(concentrations, rng),
      family: pick(families, rng),
      accords,
      notes: { top: ["A"], mid: ["B"], base: ["C"] },
      sizeMl: pick(sizes, rng),
      priceMinor: 15000 + Math.floor(rng() * 100000),
      rating: hasRating ? (2.5 + rng() * 2.5).toFixed(1) : null,
      ratingCount: hasRating ? Math.floor(rng() * 800) + 1 : null,
      year: 2005 + Math.floor(rng() * 20),
      description: "CI fixture",
      image: `img${i}.jpg`,
      status: "active",
      stock: Math.floor(rng() * 200),
    });
  }

  await db.insert(products).values(fixtures);

  const summary = fixtures.reduce((acc, p) => {
    acc[p.gender] = (acc[p.gender] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`seeded ${fixtures.length} products:`, summary);
}

main();
