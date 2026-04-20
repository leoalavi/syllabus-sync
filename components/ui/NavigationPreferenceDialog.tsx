'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/mq/button';
import { Map, Navigation } from 'lucide-react';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';

interface NavigationPreferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buildingId: string;
  room?: string;
}

export function NavigationPreferenceDialog({
  open,
  onOpenChange,
  buildingId,
  room,
}: NavigationPreferenceDialogProps) {
  const { t } = useTypedTranslation();
  const router = useRouter();

  // Shared: route to the in-app /map page. The `view` param selects which tab
  // (Campus vs Google Maps) renders; both tabs read `building` + `autonav` +
  // `focused` identically, so the only difference between the two handlers is
  // the `view` flag. Keeping users in-app means we reuse their live location
  // marker and avoid the Google Maps website entirely.
  const routeToMap = useCallback(
    (view: 'campus' | 'google') => {
      const params = new URLSearchParams();
      params.set('building', buildingId.toLowerCase());
      if (room) params.set('room', room);
      params.set('autonav', 'true');
      params.set('focused', 'true');
      if (view === 'google') params.set('view', 'google');
      router.push(`/map?${params.toString()}`);
      onOpenChange(false);
    },
    [buildingId, room, router, onOpenChange],
  );

  const handleCampusMap = useCallback(() => routeToMap('campus'), [routeToMap]);
  const handleGoogleMaps = useCallback(() => routeToMap('google'), [routeToMap]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Map className="h-5 w-5 text-mq-primary" />
            {t('navigationPreference')}
          </DialogTitle>
          <DialogDescription>{t('chooseNavigationMethod')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-4">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-4"
            onClick={handleCampusMap}
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-mq-primary/10">
              <Map className="h-5 w-5 text-mq-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold">{t('campusMap')}</p>
              <p className="text-xs text-mq-content-secondary">{t('campusMapDesc')}</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-4"
            onClick={handleGoogleMaps}
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10">
              <Navigation className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold">{t('googleMaps')}</p>
              <p className="text-xs text-mq-content-secondary">{t('googleMapsDesc')}</p>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
