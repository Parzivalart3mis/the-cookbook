import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';
import { QueueProvider } from '@/components/QueueProvider';
import WakeLock from '@/components/WakeLock';
import ChromeGate from '@/components/ChromeGate';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'The Cookbook',
  description: 'A personal collection of recipes.',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
  appleWebApp: {
    title: 'Cookbook',
    statusBarStyle: 'default',
    capable: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#b45309',
  userScalable: false,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${fraunces.variable} ${inter.variable}`}
        suppressHydrationWarning
      >
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}})()`,
            }}
          />
        </head>
        <body className="min-h-screen flex flex-col antialiased">
          <QueueProvider>
            <WakeLock />
            <ChromeGate>
              <SiteHeader />
            </ChromeGate>
            <main className="flex-1">{children}</main>
            <ChromeGate>
              <footer className="border-t border-border py-6 mt-16">
                <div className="mx-auto max-w-5xl px-4 sm:px-6 text-xs text-ink-faint text-center">
                  The Cookbook — pulled fresh from Notion
                </div>
              </footer>
            </ChromeGate>
          </QueueProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
