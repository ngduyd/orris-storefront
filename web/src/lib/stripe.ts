import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

/** null when no test key is configured — the order page hides the pay button instead of crashing. */
export const stripe = key ? new Stripe(key) : null;

export const stripeEnabled = Boolean(key && process.env.STRIPE_WEBHOOK_SECRET);
