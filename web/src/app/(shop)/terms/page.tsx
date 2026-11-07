import Link from "next/link";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <p className="label">Legal</p>
      <h1 className="mt-3 font-serif text-4xl font-light">Terms of sale</h1>
      <p className="mt-4 text-sm text-ink-soft">
        These terms cover every order placed on ORRIS. Placing an order means you accept them.
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-ink-soft">
        <section>
          <h2 className="label">Orders</h2>
          <p className="mt-3">
            An order is a request to buy, not a completed sale. It is recorded as <em>pending</em> until payment is
            confirmed, then moves to <em>paid</em>, <em>processing</em>, <em>shipped</em> and <em>delivered</em>. We may
            cancel an order and refund it in full if an item turns out to be out of stock or the price was listed in
            error. Prices are shown in USD, converted from the SAR list price; prices and availability can change
            without notice.
          </p>
        </section>

        <section>
          <h2 className="label">Payments</h2>
          <p className="mt-3">
            Card payments run through Stripe. This store runs in Stripe test mode: no real card is charged, no money
            moves, and test card details must never be real card details. The order total is fixed at the moment the
            order is created; later catalog price changes do not affect it. A receipt is emailed to the address on the
            order once payment is confirmed.
          </p>
        </section>

        <section>
          <h2 className="label">Shipping</h2>
          <p className="mt-3">
            Orders are prepared and handed to a carrier, who records the carrier name and tracking code on the order.
            Once an order is marked shipped, its status page shows the carrier and tracking code. Delivery times depend
            on the carrier and destination and are estimates, not guarantees. Stock is reserved when you place an order
            and released again if the order is cancelled or left unpaid.
          </p>
        </section>

        <section>
          <h2 className="label">Returns</h2>
          <p className="mt-3">
            Unopened, sealed items can be returned within 14 days of delivery. Write to us with the order number before
            sending anything back. Opened fragrance, and items damaged after delivery, cannot be returned for hygiene
            reasons. Refunds go back to the original payment method through Stripe once the return is received and
            checked; shipping costs are refunded only when the item was faulty or the wrong item was sent.
          </p>
        </section>

        <section>
          <h2 className="label">Your account</h2>
          <p className="mt-3">
            You are responsible for the accuracy of the email and delivery address on your order, and for keeping your
            password private. We may suspend an account that is used to abuse the store.
          </p>
        </section>

        <section>
          <h2 className="label">Contact</h2>
          <p className="mt-3">
            Questions about an order, a return or these terms: reply to any ORRIS email or contact us from your{" "}
            <Link href="/account" className="link-underline text-ink">account</Link>.
          </p>
        </section>
      </div>

      <p className="mt-12 text-xs text-taupe">
        See also our <Link href="/privacy" className="link-underline text-ink">privacy notice</Link>.
      </p>
    </div>
  );
}
