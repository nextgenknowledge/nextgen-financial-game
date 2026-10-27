import Script from 'next/script';

/**
 * Google Analytics (GA4), page views only. Loads only when NEXT_PUBLIC_GA_ID is set at build time
 * (e.g. in the Cloudflare build settings), so local and test builds stay network-free. Ad features
 * and Google signals are off, and the game never sends nicknames, world names or answers.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export function Analytics() {
  if (!GA_ID || !/^G-[A-Z0-9]+$/.test(GA_ID)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}', { allow_google_signals: false, allow_ad_personalization_signals: false });`}
      </Script>
    </>
  );
}
