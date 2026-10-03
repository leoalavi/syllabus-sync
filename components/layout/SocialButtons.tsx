'use client';

import { Linkedin } from 'lucide-react';
import { APP_CONFIG, SOCIAL_LINKS } from '@/lib/config';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';

export default function SocialButtons() {
  const { t } = useTypedTranslation();
  const label = t('followOnSocial', { uniName: APP_CONFIG.name, platform: 'LinkedIn' });

  return (
    <ul className="social-buttons">
      <li>
        <a
          href={SOCIAL_LINKS.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
        >
          <Linkedin className="social-icon h-5 w-5" aria-hidden="true" />
          <span className="social-title">LinkedIn</span>
        </a>
      </li>
    </ul>
  );
}
