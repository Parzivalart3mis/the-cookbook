import { notFound } from 'next/navigation';
import { FEATURES } from '@/lib/features';

/** Hidden from the UI (see src/lib/features.ts); the page code is kept. */
export default function ShoppingListLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.shoppingList) notFound();
  return children;
}
