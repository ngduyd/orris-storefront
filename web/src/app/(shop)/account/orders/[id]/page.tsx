import { OrderDetail } from "@/components/shop/order-detail";

export const metadata = { title: "Order" };

export default async function AccountOrderPage({ params, searchParams }: PageProps<"/account/orders/[id]">) {
  const { id } = await params;
  return <OrderDetail id={id} query={await searchParams} selfPath={`/account/orders/${id}`} />;
}
