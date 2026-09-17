/**
 * First-touch marketing attribution. UTM parameters and the external referrer from the landing page are kept
 * in sessionStorage (this tab only, never sent to third parties) and attached to newsletter sign-ups and
 * advertising inquiries. Storage can be unavailable (private mode, blocked site data); everything degrades to
 * "no attribution".
 */
const KEY = 'stocktank.attribution';

export interface Attribution {
  utm?: { source?: string; medium?: string; campaign?: string };
  referrer?: string;
}

function clean(value: string | null, max = 100): string | undefined {
  const v = value?.trim();
  return v ? v.slice(0, max) : undefined;
}

export function captureAttribution(location: Pick<Location, 'search'> = window.location, referrer = document.referrer): void {
  try {
    if (sessionStorage.getItem(KEY)) return;
    const params = new URLSearchParams(location.search);
    const utm = {
      source: clean(params.get('utm_source')),
      medium: clean(params.get('utm_medium')),
      campaign: clean(params.get('utm_campaign')),
    };
    let externalReferrer: string | undefined;
    if (referrer) {
      try {
        const ref = new URL(referrer);
        if (ref.origin !== window.location.origin) externalReferrer = ref.origin.slice(0, 500);
      } catch {
        externalReferrer = undefined;
      }
    }
    const value: Attribution = {
      ...(utm.source || utm.medium || utm.campaign ? { utm } : {}),
      ...(externalReferrer ? { referrer: externalReferrer } : {}),
    };
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable: attribution is optional.
  }
}

export function getAttribution(): Attribution {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}
