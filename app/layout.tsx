import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import ClientLayout from './client-layout';
import QueryProvider from '@/components/providers/QueryProvider';
import { APP_CONFIG, UNIVERSITY_CONFIG } from '@/lib/config';
import { THEME_SCRIPT, RTL_SCRIPT } from '@/lib/security/csp';

export const metadata: Metadata = {
  title: {
    default: APP_CONFIG.name,
    template: `%s | ${APP_CONFIG.name}`,
  },
  description: APP_CONFIG.fullDescription,
  applicationName: APP_CONFIG.name,
  metadataBase: new URL(UNIVERSITY_CONFIG.website),
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: APP_CONFIG.name,
    statusBarStyle: 'default',
  },
  openGraph: {
    title: `${APP_CONFIG.name} - ${UNIVERSITY_CONFIG.name}`,
    description: APP_CONFIG.fullDescription,
    type: 'website',
    images: [
      {
        url: '/syllabus-sync-logo.png',
        alt: `${APP_CONFIG.name} logo`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/syllabus-sync-logo.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'var(--mq-background)' },
    { media: '(prefers-color-scheme: dark)', color: 'var(--mq-background)' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? '';

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: APP_CONFIG.name,
    url: UNIVERSITY_CONFIG.website,
    logo: new URL('/syllabus-sync-logo.png', UNIVERSITY_CONFIG.website).toString(),
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          key="theme-script"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
        <script key="rtl-script" nonce={nonce} dangerouslySetInnerHTML={{ __html: RTL_SCRIPT }} />
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <QueryProvider>
          <ClientLayout>{children}</ClientLayout>
        </QueryProvider>
      </body>
    </html>
  );
}
