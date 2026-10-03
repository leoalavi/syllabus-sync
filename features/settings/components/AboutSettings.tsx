'use client';

import { memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/mq/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/mq/card';
import { ExternalLink, MessageSquare, BookOpen } from 'lucide-react';
import { APP_CONFIG, EXTERNAL_LINKS } from '@/lib/config';
import { toastUtils } from '@/lib/utils/toast';
import type { TranslationKey } from '@/lib/i18n/translations';
import { MagicCard } from '@/components/ui/MagicCard';

type AboutSettingsProps = {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const AboutSettings = memo(({ t }: AboutSettingsProps) => {
  const router = useRouter();
  const handleSendFeedback = useCallback(() => {
    toastUtils.info(t('feedback'), t('feedbackPreparing'));
    window.location.href = EXTERNAL_LINKS.feedback;
  }, [t]);

  return (
    <MagicCard data-testid="about-settings">
      <Card className="mq-magic-card-content bg-mq-card-background border border-mq-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
            <span id="about-settings-heading">{t('settings_about')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3" role="region" aria-labelledby="about-settings-heading">
          {/* About */}
          <div className="p-3 bg-mq-card-background rounded-mq-lg border border-mq-border hover:border-mq-primary/20 hover:shadow-[0_0_15px_rgba(166,25,46,0.1)] transition-all duration-300">
            <h3 className="font-semibold text-mq-content mb-1">{t('aboutTitle')}</h3>
            <p className="text-mq-sm text-mq-content-secondary">
              {t('version')} {APP_CONFIG.version} - {t('aboutDesc')}
            </p>
          </div>

          {/* Privacy Policy */}
          <div className="p-3 bg-mq-card-background rounded-mq-lg border border-mq-border hover:border-mq-primary/20 hover:shadow-[0_0_15px_rgba(166,25,46,0.1)] transition-all duration-300">
            <h3 className="font-semibold text-mq-content mb-1">{t('privacyPolicy')}</h3>
            <p className="text-mq-sm text-mq-content-secondary mb-2">{t('privacyPolicyDesc')}</p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto bg-mq-button-secondary hover:bg-mq-hover-background text-mq-content"
              onClick={() => router.push('/privacy')}
            >
              {t('view')}
            </Button>
          </div>

          {/* Need Help */}
          <div className="p-3 bg-mq-card-background rounded-mq-lg border border-mq-border hover:border-mq-primary/20 hover:shadow-[0_0_15px_rgba(166,25,46,0.1)] transition-all duration-300">
            <h3 className="font-semibold text-mq-content mb-1">{t('needHelp')}</h3>
            <p className="text-mq-sm text-mq-content-secondary mb-2">{t('helpDesc')}</p>
            <a
              href={EXTERNAL_LINKS.projectInfo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto items-center rounded-mq-lg bg-mq-button-secondary px-3 py-2 text-mq-content hover:bg-mq-hover-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mq-primary"
              data-testid="project-info-link"
            >
              <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
              {t('aboutTitle')}
            </a>
          </div>

          {/* Feedback */}
          <div className="p-3 bg-mq-card-background rounded-mq-lg border border-mq-border hover:border-mq-primary/20 hover:shadow-[0_0_15px_rgba(166,25,46,0.1)] transition-all duration-300">
            <h3 className="font-semibold text-mq-content mb-1">{t('feedback')}</h3>
            <p className="text-mq-sm text-mq-content-secondary mb-2">{t('feedbackDesc')}</p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto bg-mq-button-secondary hover:bg-mq-hover-background text-mq-content"
              onClick={handleSendFeedback}
              data-testid="send-feedback-button"
            >
              <MessageSquare className="h-4 w-4 mr-2" aria-hidden="true" />
              {t('sendFeedback')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </MagicCard>
  );
});

AboutSettings.displayName = 'AboutSettings';

export default AboutSettings;
