'use client';

import { useEffect } from 'react';
import { reloadOnceForChunkError } from '@/lib/utils/chunkErrorRecovery';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/mq/button';
import { errorHandler } from '@/lib/utils/errorHandling';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';

export default function FeedError({
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
    errorHandler.logError(error, 'Feed Error Boundary', 'high');
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] px-4">
      <AlertTriangle className="h-12 w-12 text-mq-error mb-4" />
      <h2 className="text-mq-xl font-semibold text-mq-content mb-2">{t('somethingWentWrong')}</h2>
      <p className="text-mq-content-secondary mb-6 text-center max-w-sm">{t('appErrorDesc')}</p>
      <Button onClick={reset} variant="secondary" className="gap-2">
        <RefreshCcw className="h-4 w-4" />
        {t('tryAgain')}
      </Button>
    </div>
  );
}
