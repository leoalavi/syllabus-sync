// tests/settings/AboutSettings.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AboutSettings } from '@/features/settings/components';

// Mock toast utils
vi.mock('@/lib/utils/toast', () => ({
  toastUtils: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock config
vi.mock('@/lib/config', () => ({
  APP_CONFIG: {
    version: '1.0.0',
    name: 'Syllabus Sync',
    description: 'Independent student platform',
  },
  UNIVERSITY_CONFIG: {
    name: 'Macquarie University',
    shortName: 'MQ',
  },
  EXTERNAL_LINKS: {
    projectInfo: 'https://info.syllabus-sync.app',
    feedback: 'mailto:feedback@example.com',
  },
}));

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('AboutSettings', () => {
  const mockT = vi.fn((key: string) => {
    const translations: Record<string, string> = {
      settings_about: 'About',
      helpSupport: 'About Syllabus Sync',
      aboutTitle: 'About',
      version: 'Version',
      aboutDesc: 'Independent student platform',
      needHelp: 'Need Help?',
      helpDesc: 'Read about the project and its direction',
      viewDocumentation: 'View Documentation',
      documentationOpening: 'Opening documentation...',
      feedback: 'Send Feedback',
      feedbackDesc: 'Help us improve by sharing your thoughts',
      sendFeedback: 'Send Feedback',
      feedbackPreparing: 'Preparing feedback form...',
      privacyPolicy: 'Privacy Policy',
      privacyPolicyDesc: 'View our privacy policy',
      view: 'View',
    };
    return translations[key] || key;
  });

  const defaultProps = {
    t: mockT,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders about settings card', () => {
    render(<AboutSettings {...defaultProps} />);

    expect(screen.getByTestId('about-settings')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About', level: 2 })).toBeInTheDocument();
  });

  it('renders about section with version', () => {
    render(<AboutSettings {...defaultProps} />);

    // Use a more specific query since "About" appears multiple times
    expect(screen.getByRole('heading', { name: 'About', level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/Version 1.0.0/)).toBeInTheDocument();
    expect(screen.getByText(/Independent student platform/)).toBeInTheDocument();
  });

  it('renders privacy policy section', () => {
    render(<AboutSettings {...defaultProps} />);

    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('View our privacy policy')).toBeInTheDocument();
  });

  it('renders need help section', () => {
    render(<AboutSettings {...defaultProps} />);

    expect(screen.getByText('Need Help?')).toBeInTheDocument();
    expect(screen.getByText('Read about the project and its direction')).toBeInTheDocument();
  });

  it('renders the public project information link', () => {
    render(<AboutSettings {...defaultProps} />);
    expect(screen.getByTestId('project-info-link')).toHaveAttribute(
      'href',
      'https://info.syllabus-sync.app',
    );
  });

  it('renders feedback section', () => {
    render(<AboutSettings {...defaultProps} />);

    // Use getAllByText since "Send Feedback" appears multiple times (heading + button)
    expect(screen.getAllByText('Send Feedback').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Help us improve by sharing your thoughts')).toBeInTheDocument();
  });

  it('renders send feedback button', () => {
    render(<AboutSettings {...defaultProps} />);

    expect(screen.getByTestId('send-feedback-button')).toBeInTheDocument();
  });

  it('has proper region role for accessibility', () => {
    render(<AboutSettings {...defaultProps} />);

    expect(screen.getByRole('region', { name: 'About' })).toBeInTheDocument();
  });

  it('renders section headings as h3 elements', () => {
    render(<AboutSettings {...defaultProps} />);

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.length).toBeGreaterThanOrEqual(3); // About, Privacy Policy, Need Help, Feedback
  });
});
