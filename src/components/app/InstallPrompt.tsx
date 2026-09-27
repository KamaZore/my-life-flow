import { useEffect, useState } from "react";
import { Download, Monitor, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "flowday-install-dismissed-session";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return true;
  // iPadOS 13+ reports itself as macOS Safari.
  return /macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}

/**
 * Lightweight install prompt shown once on phones and desktop browsers.
 *
 * Android/desktop Chromium fire `beforeinstallprompt`, so Install uses the
 * native prompt. iOS Safari never fires it — there installation is manual
 * (Share → Add to Home Screen), so we show step-by-step guidance instead of
 * a button that can't do anything.
 */
export function InstallPrompt() {
  const { t } = useI18n();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      try {
        sessionStorage.removeItem(DISMISSED_KEY);
      } catch {
        // Storage can be unavailable in private browsing.
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Keep the banner hidden for this session even without storage.
    }
  };

  if (installed || dismissed) return null;

  const ios = isIos();
  const mobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
  const Icon = ios || mobile ? Smartphone : Monitor;
  // No native prompt event (iOS, or a browser that never fired one): guide
  // instead of offering an Install button that would do nothing.
  const guideOnly = !installEvent;

  return (
    <aside className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-lg items-center gap-3 border border-primary/30 bg-card p-3 shadow-2xl ring-1 ring-primary/10 sm:bottom-5 sm:p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{t("install.title")}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {guideOnly
            ? ios
              ? t("install.iosShare")
              : t("install.unavailable")
            : t("install.description")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {installEvent ? (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={async () => {
              await installEvent.prompt();
              const choice = await installEvent.userChoice;
              if (choice.outcome === "accepted") setInstalled(true);
              setInstallEvent(null);
              dismiss();
            }}
          >
            <Download className="size-3.5" />
            {t("install.action")}
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={dismiss}>
            {t("install.later")}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="size-8" onClick={dismiss} aria-label={t("install.later")}>
          <X className="size-4" />
        </Button>
      </div>
    </aside>
  );
}
