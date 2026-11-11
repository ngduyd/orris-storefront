"use client";

import { useActionState } from "react";
import { checkoutAction, type CheckoutState } from "@/actions/order";

export function CheckoutForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(checkoutAction, {});

  const field = "mt-1 w-full border border-line bg-transparent px-3 py-2.5 text-sm outline-none focus:border-ink";

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <p className="label">Account</p>
        <p className="mt-1 border border-line bg-ivory-deep px-3 py-2.5 text-sm text-ink-soft">{email}</p>
      </div>
      <div>
        <label htmlFor="name" className="label">Full name</label>
        <input id="name" name="name" required autoComplete="name" className={field} />
      </div>
      <div>
        <label htmlFor="phone" className="label">Phone (for the courier)</label>
        <input id="phone" name="phone" type="tel" required autoComplete="tel" inputMode="tel" className={field} />
      </div>
      <div>
        <label htmlFor="address" className="label">Shipping address</label>
        <textarea id="address" name="address" required rows={3} autoComplete="street-address" className={field} />
      </div>
      <div>
        <label htmlFor="coupon" className="label">Coupon code (optional)</label>
        <input id="coupon" name="coupon" autoComplete="off" className={field} />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-brass-text">{state.error}</p>
      ) : null}

      <button
        disabled={pending}
        className="w-full border border-ink px-8 py-3.5 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory disabled:opacity-50"
      >
        {pending ? "Placing order…" : "Place order"}
      </button>
      <p className="text-xs text-taupe">
        Totals are converted from SAR at the pegged rate of 3.75. Card payment (Stripe test mode) is offered on the
        order page; without it the order stays pending and nothing is charged.
      </p>
    </form>
  );
}
