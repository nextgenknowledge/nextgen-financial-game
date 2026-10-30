import type { Metadata, Viewport } from 'next';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
// In-world signage typefaces (bundled, latin subset only)
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-800.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/oswald/latin-600.css';
import '@fontsource/bebas-neue/latin-400.css';
import './globals.css';
import { Analytics } from './Analytics';

const DESCRIPTION =
  'Fin City is a free 3D financial literacy game for kids and teens (ages 6 to 18). Explore five cities, play 40+ money activities and learn budgeting, saving, banking, credit, taxes and investing. Plays in your browser, no download or account.';

export const metadata: Metadata = {
  metadataBase: new URL('https://fincity.dev'),
  title: 'Fin City | Free Financial Literacy Game for Kids and Teens',
  description: DESCRIPTION,
  applicationName: 'Fin City',
  keywords: ['financial literacy game', 'money game for kids', 'money game for teens', 'free financial literacy', 'budgeting game', 'investing game for students', 'personal finance game', 'NextGen Knowledge'],
  authors: [{ name: 'NextGen Knowledge', url: 'https://nextgenknowledge.org' }],
  creator: 'NextGen Knowledge',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Fin City | Free Financial Literacy Game',
    description: DESCRIPTION,
    url: 'https://fincity.dev',
    siteName: 'Fin City',
    type: 'website',
    images: [{ url: '/share.jpg', width: 1200, height: 630, alt: 'Fin City, a free financial literacy game by NextGen Knowledge' }],
  },
  twitter: { card: 'summary_large_image', title: 'Fin City | Free Financial Literacy Game', description: DESCRIPTION, images: ['/share.jpg'] },
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/brand/fin-city-logo.webp` },
};

/** Tells search engines what Fin City is (a free educational browser game) and who makes it. */
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'VideoGame',
      '@id': 'https://fincity.dev/#game',
      name: 'Fin City',
      url: 'https://fincity.dev',
      description: DESCRIPTION,
      genre: ['Educational', 'Simulation'],
      gamePlatform: 'Web browser',
      applicationCategory: 'Game',
      operatingSystem: 'Any',
      inLanguage: 'en',
      isAccessibleForFree: true,
      typicalAgeRange: '6-18',
      educationalUse: 'Financial literacy',
      image: 'https://fincity.dev/share.jpg',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': 'https://nextgenknowledge.org/#org' },
    },
    {
      '@type': 'EducationalOrganization',
      '@id': 'https://nextgenknowledge.org/#org',
      name: 'NextGen Knowledge',
      url: 'https://nextgenknowledge.org/',
      sameAs: ['https://www.instagram.com/nextgen.knowledge/', 'https://www.linkedin.com/company/next-gen-knowledge/'],
    },
  ],
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f1a3d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
        {children}
        {/* Read by search engines and by anyone with JavaScript turned off (the game itself needs it) */}
        <noscript>
          <h1>Fin City: a free financial literacy game for kids and teens</h1>
          <p>{DESCRIPTION}</p>
          <p>
            Made by <a href="https://nextgenknowledge.org">NextGen Knowledge</a>, a student-led financial literacy organization.{' '}
            <a href="https://nextgenknowledge.org/fin-city.html">Learn more about Fin City</a>. Turn on JavaScript to play.
          </p>
        </noscript>
        <Analytics />
      </body>
    </html>
  );
}
