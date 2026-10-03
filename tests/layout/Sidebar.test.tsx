import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/home',
}));

vi.mock('@/lib/hooks/useTypedTranslation', () => ({
  useTypedTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/lib/store/gamificationStore', () => ({
  useGamificationStore: (selector: (state: { profile: null }) => unknown) =>
    selector({ profile: null }),
}));

vi.mock('@/lib/utils/gamification', () => ({
  getLevelTitleKey: () => 'levelTitle',
}));

vi.mock('@/components/brand/BrandLogo', () => ({
  BrandLogo: () => <div data-testid="brand-logo" />,
}));

vi.mock('@/components/layout/SocialButtons', () => ({
  default: () => <div data-testid="social-buttons" />,
}));

import Sidebar from '@/components/layout/Sidebar';

describe('Sidebar mobile drawer accessibility', () => {
  it('keeps the mobile drawer hidden from assistive tech until opened', () => {
    render(<Sidebar />);

    const drawer = document.getElementById('mobile-sidebar');
    expect(drawer).not.toBeNull();
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
    expect(drawer).toHaveAttribute('inert');
    expect(drawer).not.toHaveAttribute('role');
  });

  it('exposes the drawer as a dialog when opened from the menu button', () => {
    render(<Sidebar />);

    fireEvent.click(screen.getAllByRole('button', { name: 'openMenu' })[0]);

    const drawer = document.getElementById('mobile-sidebar');
    expect(drawer).toHaveAttribute('role', 'dialog');
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(drawer).toHaveAttribute('aria-hidden', 'false');
    expect(drawer).not.toHaveAttribute('inert');
    expect(within(drawer!).getByRole('navigation', { name: 'mainNavigation' })).toBeInTheDocument();
  });
});
