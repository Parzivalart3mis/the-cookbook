import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';

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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Set theme class before paint to avoid flash of unstyled content */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}})()`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border py-6 mt-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 text-xs text-ink-faint text-center">
            The Cookbook — pulled fresh from Notion
          </div>
        </footer>
      </body>
    </html>
  );
}
