const CLOUD = process.env.CLOUDINARY_CLOUD;

/** Catalog images: Cloudinary when CLOUDINARY_CLOUD is set, otherwise local files in public/images. */
export function imageUrl(name: string, width = 800): string {
  if (!name) return "";
  if (name.startsWith("/")) return name; // file upload local trong public/uploads
  if (!CLOUD) return `/images/${name}`;
  const id = name.replace(/\.(webp|jpe?g|png)$/i, "");
  return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,w_${width}/perfumes/${id}.webp`;
}

/** Ảnh chính: images[0] khi có gallery, không thì cột image cũ. */
export const primaryImage = (p: { image: string; images?: string[] }) => p.images?.[0] || p.image;
