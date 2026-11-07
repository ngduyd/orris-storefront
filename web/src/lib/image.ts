const CLOUD = process.env.CLOUDINARY_CLOUD;

/** Catalog images: Cloudinary when CLOUDINARY_CLOUD is set, otherwise local files in public/images. */
export function imageUrl(name: string, width = 800): string {
  if (!name) return "";
  if (!CLOUD) return `/images/${name}`;
  const id = name.replace(/\.(webp|jpe?g|png)$/i, "");
  return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,w_${width}/perfumes/${id}.webp`;
}
