import { track } from "@/lib/analytics";
import { browserStore } from "@/lib/browser-store";
import {
  countVisit,
  dismissOffer,
  INSTALL_STATE_KEY,
  isIosDevice,
  markInstalled,
  parseInstallState,
  shouldOfferInstall,
  type InstallState,
} from "./install-policy";

/** What to show: nothing, the Add button (Android, desktop Chrome), or the iPhone how-to. */
export type InstallOffer = "none" | "prompt" | "ios";

/** The browser's install prompt event (not yet part of TypeScript's DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SESSION_KEY = "pwa:install:session";

/**
 * Decides whether the "Add to home screen" strip is shown and runs the browser's
 * install prompt (Part F4.4). It is one object for the whole page, because the
 * browser fires its `beforeinstallprompt` event only once, possibly before the
 * strip is on screen. React reads it with `useSyncExternalStore`.
 */
export class InstallController {
  private started = false;
  private deferred: BeforeInstallPromptEvent | null = null;
  private offer: InstallOffer = "none";
  private readonly listeners = new Set<() => void>();

  /** Starts listening and counts this visit (once per browser session). Safe to call many times. */
  start = (): void => {
    if (this.started || typeof window === "undefined") return;
    this.started = true;

    if (this.isStandalone()) {
      // Opened from the home screen: it is installed already.
      this.save(markInstalled(this.load()));
      return;
    }

    this.countThisVisit();
    window.addEventListener("beforeinstallprompt", this.onBeforeInstallPrompt);
    window.addEventListener("appinstalled", this.onInstalled);
    this.refresh();
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): InstallOffer => this.offer;

  /** "Add": shows the browser's own install box. */
  install = async (): Promise<void> => {
    const event = this.deferred;
    if (!event) return;
    this.deferred = null;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "dismissed") this.dismiss();
    else this.refresh();
  };

  /** "Not now": stay quiet for a month. */
  dismiss = (): void => {
    this.save(dismissOffer(this.load(), new Date()));
    this.refresh();
  };

  private readonly onBeforeInstallPrompt = (event: Event): void => {
    // Keep the event; the strip decides when to show the browser's box.
    event.preventDefault();
    this.deferred = event as BeforeInstallPromptEvent;
    this.refresh();
  };

  private readonly onInstalled = (): void => {
    track("pwa_installed", {});
    this.deferred = null;
    this.save(markInstalled(this.load()));
    this.refresh();
  };

  private refresh(): void {
    const next = this.decide();
    if (next === this.offer) return;
    this.offer = next;
    this.listeners.forEach((listener) => listener());
  }

  private decide(): InstallOffer {
    if (!shouldOfferInstall(this.load(), new Date())) return "none";
    if (this.deferred) return "prompt";
    return isIosDevice(navigator.userAgent, navigator.maxTouchPoints) ? "ios" : "none";
  }

  private countThisVisit(): void {
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // No session storage: count it as a visit anyway, once for this page.
    }
    this.save(countVisit(this.load()));
  }

  private isStandalone(): boolean {
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
  }

  private load(): InstallState {
    return parseInstallState(browserStore.read(INSTALL_STATE_KEY));
  }

  private save(state: InstallState): void {
    browserStore.write(INSTALL_STATE_KEY, JSON.stringify(state));
  }
}

/** The one controller for the page. */
export const installController = new InstallController();
