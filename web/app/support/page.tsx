import type { Metadata } from 'next';
import { RELEASE } from '@/lib/release';
import { Icon } from '../components/icons';
import '../landing.css';

export const metadata: Metadata = { title: 'Bug reports' };

export default function Support() {
  return (
    <section className="download" aria-labelledby="support-title">
      <p className="section-label">Support</p>
      <h1 id="support-title" className="section-title">Report a bug</h1>
      <p className="band-text" style={{ marginInline: 'auto' }}>Reports are tracked on GitHub Issues. Sign in to GitHub to submit a report or follow its progress. Your SAO Menu account is used for friends and messages.</p>
      <div className="hero-actions">
        <a className="menu-button primary" href={RELEASE.report}><span className="disc"><Icon name="arrow" /></span><span>Report a bug<small>GitHub issue form</small></span></a>
        <a className="menu-button" href={RELEASE.issues}><span className="disc"><Icon name="browser" /></span><span>View issues<small>Search existing reports</small></span></a>
      </div>
      <ul className="download-facts">
        <li>Include your app version, operating system and steps to reproduce.</li>
        <li>For animation or gesture problems, attach a screen recording and include your display refresh rate.</li>
        <li>Reports are public. Remove passwords, session tokens and private messages from screenshots or logs.</li>
      </ul>
    </section>
  );
}
