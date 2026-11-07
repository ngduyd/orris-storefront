import Link from "next/link";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <p className="label">Legal</p>
      <h1 className="mt-3 font-serif text-4xl font-light">Privacy notice</h1>
      <p className="mt-4 text-sm text-ink-soft">
        What ORRIS stores about you, why, and how long we keep it.
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-ink-soft">
        <section>
          <h2 className="label">What we store</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="font-normal text-ink">Account</strong> — your email address, a hash of your password
              (never the password itself), an optional display name, and whether the email is verified. If you sign in
              with Google we also store the Google account id.
            </li>
            <li>
              <strong className="font-normal text-ink">Order</strong> — recipient name, delivery address, the items,
              quantities and prices, the order status, and the carrier and tracking code once shipped.
            </li>
            <li>
              <strong className="font-normal text-ink">Order history</strong> — every order you place stays linked to
              your account so you can look it up later and so reviews can be tied to a paid order.
            </li>
            <li>
              <strong className="font-normal text-ink">Bag</strong> — the cart contents are stored against an anonymous
              cart id in a cookie, and against your account once you check out.
            </li>
            <li>
              <strong className="font-normal text-ink">Session</strong> — a signed-in session id in an http-only cookie,
              valid for seven days.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="label">What we do not store</h2>
          <p className="mt-3">
            Card numbers never reach our server. Payments are handled by Stripe, which gives us a checkout session id
            and, for paid orders, the payment reference needed to issue refunds. This store runs in Stripe test mode, so
            no real payment is taken.
          </p>
        </section>

        <section>
          <h2 className="label">Who sees it</h2>
          <p className="mt-3">
            Shop staff (managers) can see orders, customers and order history in order to fulfil orders and answer
            questions. Carriers can see the order, the delivery address and the shipping status, and can update the
            carrier and tracking code. Nobody else at ORRIS sees your data.
          </p>
        </section>

        <section>
          <h2 className="label">Email</h2>
          <p className="mt-3">
            We email you order receipts, shipping notices, address-verification links and password-reset links. These
            are transactional messages sent because you placed an order or asked for them; we do not run a newsletter.
          </p>
        </section>

        <section>
          <h2 className="label">Your choices</h2>
          <p className="mt-3">
            You can request a copy of your data, correction of your details, or deletion of your account. Orders are
            kept as long as tax and accounting rules require, even after an account is deleted; the personal fields on
            those orders are then no longer needed to serve you. Write to us from your{" "}
            <Link href="/account" className="link-underline text-ink">account</Link> to make a request.
          </p>
        </section>

        <section>
          <h2 className="label">Cookies</h2>
          <p className="mt-3">
            We set three cookies: your cart id, the cart item count for the header badge, and — when you sign in — a
            session cookie. No analytics or advertising cookies are set.
          </p>
        </section>
      </div>

      <p className="mt-12 text-xs text-taupe">
        See also our <Link href="/terms" className="link-underline text-ink">terms of sale</Link>.
      </p>
    </div>
  );
}
