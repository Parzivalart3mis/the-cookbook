'use client';

import { usePathname } from 'next/navigation';

/** Routes that render their own full-page chrome (nav + footer). */
const IMMERSIVE_ROUTES = ['/welcome'];

/**
 * Hides the global site header/footer on immersive routes so the landing
 * page controls its own layout end to end.
 */
export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (IMMERSIVE_ROUTES.includes(pathname)) return null;
  return <>{children}</>;
}
