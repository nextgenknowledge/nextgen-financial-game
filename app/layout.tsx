import type { Metadata, Viewport } from 'next';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import '@fontsource/pixelify-sans/500.css';
import '@fontsource/pixelify-sans/700.css';
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

export const metadata: Metadata = {
  title: 'Fin City · NextGen Knowledge',
  description: 'Explore Fin City, play money games, and grow your net worth with NextGen Narwhal.',
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/brand/fin-city-logo.webp` },
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
      <body>{children}</body>
    </html>
  );
}
