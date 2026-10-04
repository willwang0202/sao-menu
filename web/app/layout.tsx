import type { Metadata, Viewport } from 'next';
import { Saira_Semi_Condensed, Source_Sans_3 } from 'next/font/google';
import { SiteHeader } from './components/site-header';
import './globals.css';

const saira = Saira_Semi_Condensed({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-saira' });
const source = Source_Sans_3({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-source' });

export const metadata: Metadata = {
  metadataBase: new URL('https://sao-menu.favioon.com'),
  title: { default: 'SAO Menu: Link Start', template: '%s · SAO Menu' },
  description: 'The Sword Art Online ring-menu launcher for macOS, Windows and Linux. Real-time Link Start, curved browser, hand gestures, friends and messages.',
  openGraph: { title: 'SAO Menu', description: 'Link Start on your desktop.', url: 'https://sao-menu.favioon.com', siteName: 'SAO Menu' },
};

export const viewport: Viewport = { themeColor: '#ececec' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${saira.variable} ${source.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
