import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

/** null khi chưa cấu hình khoá test — trang đơn sẽ ẩn nút thanh toán thay vì crash. */
export const stripe = key ? new Stripe(key) : null;

export const stripeEnabled = Boolean(key && process.env.STRIPE_WEBHOOK_SECRET);
