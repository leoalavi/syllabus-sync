import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/settings/general',
}));

vi.mock('@/lib/hooks/useHydration', () => ({
  useHydration: () => true,
}));

vi.mock('@/lib/hooks/useTypedTranslation', () => ({
  useTypedTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ErrorBoundary', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/settings/components/SettingsSectionBoundary', () => ({
  SettingsSectionBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/MovingMeshBackground', () => ({
  default: () => <div data-testid="mesh-background" />,
}));

vi.mock('@/features/settings/components', () => ({
  SettingsSkeleton: () => <div>loading</div>,
}));

import SettingsPage from '@/app/settings/layout';

describe('Settings layout landmarks', () => {
  it('does not add a second main landmark inside the shared layout shell', () => {
    render(
      <main role="main">
        <SettingsPage>
          <div>Settings content</div>
        </SettingsPage>
      </main>,
    );

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByText('Settings content')).toBeInTheDocument();
  });
});
