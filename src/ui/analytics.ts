/** Sends a milestone to Google Analytics. gtag only exists on builds with NEXT_PUBLIC_GA_ID set. */
export function trackEvent(name: string, params: Record<string, string | number> = {}) {
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === 'function') gtag('event', name, params);
}
