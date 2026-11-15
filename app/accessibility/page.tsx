import type { Metadata } from 'next';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const TITLE = 'Accessibility | Fin City';
const DESCRIPTION = 'How Fin City supports players with disabilities, what we are still working on and how to tell us about a barrier.';
const UPDATED = 'November 15, 2026';
const CONTACT = 'nextgen.knowledge123@gmail.com';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/accessibility/' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: 'https://fincity.dev/accessibility/', siteName: 'Fin City', type: 'website', images: ['/share.jpg'] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/share.jpg'] },
};

export default function AccessibilityPage() {
  return (
    <main className="about-page">
      <div className="about-inner">
        <h1>Accessibility statement</h1>
        <p className="muted">Last updated {UPDATED}</p>
        <p>
          We want every kid and teen to be able to play Fin City. We aim to meet the Web Content Accessibility Guidelines (WCAG)
          2.2 at level AA for the website and the game&apos;s menus, screens and text, and we keep improving the parts that
          don&apos;t meet it yet.
        </p>

        <h2>What Fin City offers</h2>
        <p>Open Settings from the title screen or the pause menu to find these:</p>
        <ul>
          <li>Read-aloud: Narwhal&apos;s tips and questions can be read out loud, with a choice of voice and reading speed, and every text has a speaker button.</li>
          <li>Text size from S to XL.</li>
          <li>Colorblind-safe colors for red-green and blue-yellow color blindness.</li>
          <li>Reduced motion, which cuts camera sway, confetti and animation. It turns on by itself if your device asks for less motion.</li>
          <li>Keyboard controls you can remap, plus adjustable look speed and camera follow.</li>
          <li>Narwhal hints and a screen tour that explains the buttons again.</li>
          <li>Longer or shorter in-game months, so players can go at their own pace.</li>
          <li>Separate music and sound effect volume, and Low, Medium and High quality for Chromebooks and older computers.</li>
        </ul>
        <p>The About, Privacy, Terms and this page work with screen readers and keyboard navigation.</p>

        <h2>Known limitations</h2>
        <p>
          The city itself is drawn in 3D, so walking around it depends on seeing the screen and isn&apos;t fully usable with a
          screen reader yet. Some timed activities may be hard for players who need more time. We&apos;re working on both.
        </p>

        <h2>Tell us about a barrier</h2>
        <p>
          If something in Fin City is hard or impossible for you to use, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and tell
          us what you were trying to do and what device and browser you were using. We aim to reply within 5 business days.
        </p>

        <p>
          <a href={`${BASE}/`}>Back to the game</a> · <a href={`${BASE}/about/`}>About Fin City</a> ·{' '}
          <a href={`${BASE}/privacy/`}>Privacy policy</a> · <a href={`${BASE}/terms/`}>Terms of use</a>
        </p>
      </div>
    </main>
  );
}
