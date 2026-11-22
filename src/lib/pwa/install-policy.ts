/**
 * When to offer "Add to home screen" (Part F4.4): after the second visit,
 * never to someone who already added it, and not again for a month after
 * they said "Not now". Pure rules with no browser code, so they are easy to test.
 */

export const INSTALL_STATE_KEY = "pwa:install:v1";

/** Visits (browser sessions) before the offer is shown. */
export const VISITS_BEFORE_OFFER = 2;

/** After "Not now", stay quiet this many days. */
export const QUIET_DAYS_AFTER_DISMISS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface InstallState {
  /** How many separate visits (browser sessions) this phone has made. */
  visits: number;
  /** When the person last said "Not now" (ISO time), or null. */
  dismissedAt: string | null;
  /** True once the app was added to the home screen. */
  installed: boolean;
}

export const EMPTY_INSTALL_STATE: InstallState = { visits: 0, dismissedAt: null, installed: false };

/** Reads the saved text; anything unreadable or odd becomes a fresh state. */
export function parseInstallState(raw: string | null): InstallState {
  if (!raw) return EMPTY_INSTALL_STATE;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return EMPTY_INSTALL_STATE;
    const { visits, dismissedAt, installed } = value as Record<string, unknown>;
    return {
      visits: typeof visits === "number" && Number.isFinite(visits) && visits >= 0 ? Math.floor(visits) : 0,
      dismissedAt:
        typeof dismissedAt === "string" && !Number.isNaN(Date.parse(dismissedAt)) ? dismissedAt : null,
      installed: installed === true,
    };
  } catch {
    return EMPTY_INSTALL_STATE;
  }
}

export function countVisit(state: InstallState): InstallState {
  return { ...state, visits: Math.min(state.visits + 1, 1000) };
}

export function dismissOffer(state: InstallState, now: Date): InstallState {
  return { ...state, dismissedAt: now.toISOString() };
}

export function markInstalled(state: InstallState): InstallState {
  return { ...state, installed: true };
}

/** True when the offer should be shown now. */
export function shouldOfferInstall(state: InstallState, now: Date): boolean {
  if (state.installed) return false;
  if (state.visits < VISITS_BEFORE_OFFER) return false;
  if (state.dismissedAt !== null) {
    const quietUntil = Date.parse(state.dismissedAt) + QUIET_DAYS_AFTER_DISMISS * DAY_MS;
    if (now.getTime() < quietUntil) return false;
  }
  return true;
}

/**
 * iPhones and iPads cannot show an install button: the person must use the
 * Share menu, so they get a short how-to instead (Part F4.4). iPadOS 13+ says
 * it is a Mac, so touch support is checked too.
 */
export function isIosDevice(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}
