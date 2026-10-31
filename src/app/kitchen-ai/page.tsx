import KitchenAILoader from './KitchenAILoader';
import type { TabId } from './KitchenAIClient';

export const metadata = { title: 'AI Kitchen — The Cookbook' };

const TABS: TabId[] = ['discover', 'pantry', 'protein'];

export default async function KitchenAIPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = TABS.includes(tab as TabId) ? (tab as TabId) : 'discover';
  return <KitchenAILoader initialTab={initialTab} />;
}
