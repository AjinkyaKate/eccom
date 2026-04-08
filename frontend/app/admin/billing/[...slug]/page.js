import { redirect } from 'next/navigation';

export default function AdminBillingNestedRedirectPage() {
  redirect('/admin/orders');
}
