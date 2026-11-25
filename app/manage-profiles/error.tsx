'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import { reloadOnceForChunkError } from '@/lib/utils/chunkErrorRecovery';
import { Button } from '@/components/ui/mq/button';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { logger } from '@/lib/logger';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTypedTranslation();
  useEffect(() => {
    // A stale chunk after a deploy only recovers with a full reload.
    if (reloadOnceForChunkError(error)) return;
    // Log the error to your observability service (e.g., Sentry)
    logger.error('Profile Page Crash:', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] px-4 py-8 flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-mq-error/10 p-4">
        <AlertTriangle className="h-8 w-8 text-mq-error" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-mq-content">{t('somethingWentWrong')}</h2>
        <p className="text-mq-content-secondary max-w-md mx-auto">{t('errorProfileLoad')}</p>
      </div>
      <Button onClick={() => reset()} variant="outline" className="gap-2">
        <RefreshCcw className="h-4 w-4" />
        {t('tryAgain')}
      </Button>
    </div>
  );
}
