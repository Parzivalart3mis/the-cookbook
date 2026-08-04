'use client';

import Link from 'next/link';
import { SignInButton, UserButton } from '@clerk/nextjs';
import { useAuth } from '@clerk/nextjs';
import { Lightbulb } from 'lucide-react';

export default function HeaderAuthArea() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;

  if (isSignedIn) {
    return (
      <>
        <Link
          href="/future-recipes"
          title="Future Recipes"
          aria-label="Future Recipes"
          className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150"
        >
          <Lightbulb size={18} />
        </Link>
        <UserButton />
      </>
    );
  }

  return (
    <SignInButton mode="modal">
      <button className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted hover:text-ink hover:border-accent/30 transition-colors duration-150">
        Sign in
      </button>
    </SignInButton>
  );
}
