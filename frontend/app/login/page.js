import CustomerLoginPage from '@/components/CustomerLoginPage';

export default async function LoginPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  return <CustomerLoginPage redirectTo={resolvedSearchParams?.redirect || '/cart'} />;
}
