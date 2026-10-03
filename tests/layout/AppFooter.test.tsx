import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppFooter from '@/components/layout/AppFooter';

vi.mock('@/lib/hooks/useTypedTranslation', () => ({
  useTypedTranslation: () => ({
    t: (key: string, vars?: Record<string, string | number>) =>
      key === 'copyright' ? `© ${vars?.year} Syllabus Sync` : key,
  }),
}));

describe('AppFooter', () => {
  it('links to the public project information site', () => {
    render(<AppFooter />);

    const link = screen.getByRole('link', { name: 'projectInfoLink' });
    expect(link).toHaveAttribute('href', 'https://info.syllabus-sync.app');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
