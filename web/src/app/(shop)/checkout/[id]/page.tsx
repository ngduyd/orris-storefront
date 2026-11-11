import { OrderDetail } from "@/components/shop/order-detail";

export const metadata = { title: "Order placed" };

export default async function OrderPage({ params, searchParams }: PageProps<"/checkout/[id]">) {
  const { id } = await params;
  return <OrderDetail id={id} query={await searchParams} selfPath={`/checkout/${id}`} />;
}
