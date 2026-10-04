import Link from 'next/link';
import { sessionToken } from '@/lib/session';

export async function SiteHeader() {
  const signedIn = !!await sessionToken();
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="SAO Utils home"><span className="wordmark-ring" aria-hidden="true" />SAO Utils</Link>
      <nav className="site-nav" aria-label="Main">
        <Link href="/#download">Download</Link>
        {signedIn ? <Link href="/account">Account</Link> : <><Link href="/login">Sign in</Link><Link className="nav-optional" href="/register">Create account</Link></>}
      </nav>
    </header>
  );
}
