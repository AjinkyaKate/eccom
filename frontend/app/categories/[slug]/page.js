import { redirect } from 'next/navigation';

// /categories/[slug] → redirect to products page filtered by category
export default async function CategoryPage({ params }) {
  const { slug } = await params;
  redirect(`/products?category=${encodeURIComponent(slug)}`);
}
