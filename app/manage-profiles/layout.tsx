// app/manage-profiles/layout.tsx
import { Metadata } from 'next';
import { APP_CONFIG, UNIVERSITY_CONFIG } from '@/lib/config';

export const metadata: Metadata = {
  title: `${APP_CONFIG.name} - Manage Profiles`,
  description: 'Create, edit, and manage your user profiles for Syllabus Sync.',
  openGraph: {
    title: `${APP_CONFIG.name} - Manage Profiles`,
    description: 'Create, edit, and manage your user profiles for Syllabus Sync.',
    type: 'website',
    images: [
      {
        url: `${UNIVERSITY_CONFIG.website}/syllabus-sync-logo.png`,
        alt: `${APP_CONFIG.name} logo`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [`${UNIVERSITY_CONFIG.website}/syllabus-sync-logo.png`],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function ManageProfilesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
