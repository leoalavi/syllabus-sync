import { Metadata } from 'next';
import { Suspense } from 'react';
import { APP_CONFIG } from '@/lib/config';
import AboutClient from './about-client';

export const metadata: Metadata = {
  title: `About — ${APP_CONFIG.name}`,
  description: APP_CONFIG.fullDescription,
  openGraph: {
    title: `About — ${APP_CONFIG.name}`,
    description: APP_CONFIG.fullDescription,
    type: 'website',
  },
};

function AboutSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading about page"
      className="min-h-screen bg-mq-background"
    >
      <div className="h-64 bg-mq-primary/20 animate-pulse" />
      <div className="mx-auto max-w-6xl px-4 py-14 space-y-6">
        <div className="h-7 w-48 bg-mq-border rounded animate-pulse" />
        <div className="h-4 w-80 bg-mq-border rounded animate-pulse" />
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-mq-border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <Suspense fallback={<AboutSkeleton />}>
      <AboutClient />
    </Suspense>
  );
}
