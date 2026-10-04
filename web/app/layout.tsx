import type { Metadata, Viewport } from 'next';
import { Saira_Semi_Condensed, Source_Sans_3 } from 'next/font/google';
import { SiteHeader } from './components/site-header';
import './globals.css';

const saira = Saira_Semi_Condensed({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-saira' });
const source = Source_Sans_3({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-source' });

export const metadata: Metadata = {
  metadataBase: new URL('https://sao.favioon.com'),
  title: { default: 'SAO Utils for macOS: Link Start', template: '%s · SAO Utils' },
  description: 'The Sword Art Online ring-menu launcher, rebuilt for macOS. Real-time Link Start, curved browser, hand gestures, and an account for friends and messages.',
  openGraph: { title: 'SAO Utils for macOS', description: 'Link Start on your Mac.', url: 'https://sao.favioon.com', siteName: 'SAO Utils' },
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
