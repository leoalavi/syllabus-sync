"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/mq/button";
import { Apple, Navigation, Play } from "lucide-react";
import { useTypedTranslation } from "@/lib/hooks/useTypedTranslation";
import {
  CAMPUS_NAV_ANDROID_STORE_URL,
  CAMPUS_NAV_IOS_STORE_URL,
  isIosStoreAvailable,
} from "@/lib/campus-navigation/config";
import { detectPlatform } from "@/lib/campus-navigation/platform";

interface CampusNavInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shown when a navigation handoff could not reach the Campus Navigation app.
 *
 * Offers exactly two destinations — App Store and Google Play. There is
 * deliberately NO "open in web" option: Campus Navigation is an Android + iOS
 * product with no web build, so a web button would lead nowhere.
 *
 * The iOS listing does not exist yet. Rather than linking somewhere invented,
 * that button renders disabled and labelled "coming soon" until
 * NEXT_PUBLIC_CAMPUS_NAV_IOS_STORE_URL is set.
 */
export function CampusNavInstallDialog({
  open,
  onOpenChange,
}: CampusNavInstallDialogProps) {
  const { t } = useTypedTranslation();
  // Detection only orders the list; both options stay reachable either way.
  const platform = useMemo(() => detectPlatform(), []);
  const iosReady = isIosStoreAvailable();

  const iosButton = (
    <Button
      key="ios"
      variant="outline"
      className="w-full justify-start gap-3 h-auto py-4"
      disabled={!iosReady}
      aria-disabled={!iosReady}
      onClick={
        iosReady
          ? () =>
              window.open(
                CAMPUS_NAV_IOS_STORE_URL as string,
                "_blank",
                "noopener,noreferrer",
              )
          : undefined
      }
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-mq-content/10">
        <Apple className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="text-left">
        <p className="font-semibold">{t("campusNavDownloadIos")}</p>
        <p className="text-xs text-mq-content-secondary">
          {iosReady ? t("campusNavIosSubtitle") : t("campusNavIosComingSoon")}
        </p>
      </div>
    </Button>
  );

  const androidButton = (
    <Button
      key="android"
      variant="outline"
      className="w-full justify-start gap-3 h-auto py-4"
      onClick={() =>
        window.open(
          CAMPUS_NAV_ANDROID_STORE_URL,
          "_blank",
          "noopener,noreferrer",
        )
      }
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10">
        <Play className="h-5 w-5 text-emerald-600" aria-hidden="true" />
      </div>
      <div className="text-left">
        <p className="font-semibold">{t("campusNavDownloadAndroid")}</p>
        <p className="text-xs text-mq-content-secondary">
          {t("campusNavAndroidSubtitle")}
        </p>
      </div>
    </Button>
  );

  // Lead with the viewer's own platform; keep both available.
  const buttons =
    platform === "android"
      ? [androidButton, iosButton]
      : [iosButton, androidButton];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-mq-primary" />
            {t("campusNavInstallTitle")}
          </DialogTitle>
          <DialogDescription>{t("campusNavInstallDesc")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-4">{buttons}</div>
      </DialogContent>
    </Dialog>
  );
}
