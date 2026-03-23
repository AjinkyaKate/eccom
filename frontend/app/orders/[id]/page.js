import CustomerOrderDetailPage from '@/components/orders/CustomerOrderDetailPage';

export default async function CustomerOrderRoute({ params }) {
  const { id } = await params;
  return <CustomerOrderDetailPage orderId={id} />;
}
