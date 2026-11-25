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
import { ExternalLink, Globe, Map, Navigation, Smartphone } from 'lucide-react';
import {
  CAMPUS_NAV_ANDROID_STORE_URL,
  CAMPUS_NAV_IOS_STORE_URL,
  buildCampusNavWebUrl,
} from '@/lib/campus-navigation/config';
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

  // Campus Navigation companion: the mobile app is the recommended way to
  // navigate; until it is in the stores, its web app is offered instead.
  const campusNavWebUrl = buildCampusNavWebUrl(buildingId);
  const storeLinks = [
    { label: 'App Store', href: CAMPUS_NAV_IOS_STORE_URL },
    { label: 'Google Play', href: CAMPUS_NAV_ANDROID_STORE_URL },
  ].filter((link): link is { label: string; href: string } => link.href !== null);

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
          <section
            aria-labelledby="campus-nav-heading"
            data-testid="campus-nav-handoff"
            className="rounded-mq border border-mq-primary/30 bg-mq-primary/5 p-3"
          >
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-lg bg-mq-primary/10">
                <Smartphone className="h-5 w-5 text-mq-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p id="campus-nav-heading" className="font-semibold">
                  {t('campusNavHandoffTitle')}
                </p>
                <p className="text-xs text-mq-content-secondary">{t('campusNavHandoffDesc')}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {storeLinks.length > 0 ? (
                storeLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-mq border border-mq-border px-3 py-1.5 text-xs font-medium hover:bg-mq-surface"
                  >
                    {link.label}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ))
              ) : (
                <span
                  data-testid="campus-nav-app-coming-soon"
                  className="inline-flex items-center rounded-full bg-mq-surface px-3 py-1 text-xs text-mq-content-secondary"
                >
                  {t('campusNavAppComingSoon')}
                </span>
              )}
            </div>

            {campusNavWebUrl && (
              <a
                href={campusNavWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onOpenChange(false)}
                data-testid="campus-nav-web-link"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-mq bg-mq-primary px-3 py-2 text-sm font-semibold text-white hover:bg-mq-primary/90"
              >
                <Globe className="h-4 w-4" aria-hidden="true" />
                {t('campusNavOpenWeb')}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </section>

          <p className="text-xs font-medium text-mq-content-secondary">{t('campusNavOrUseHere')}</p>

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
