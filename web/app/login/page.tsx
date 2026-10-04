import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SystemForm } from '../components/system-form';
import { login } from '../actions';
import { sessionToken } from '@/lib/session';
import '../components/auth.css';

export const metadata: Metadata = { title: 'Log in' };

export default async function LoginPage() {
  if (await sessionToken()) redirect('/account');
  return (
    <div className="auth-room">
      <div>
        <SystemForm title="Log in_::" submit="Log in" pending="Signing in…" action={login} alternate={{ href: '/register', label: 'Create an account' }}
          fields={[
            { name: 'username', label: 'account', autoComplete: 'username', minLength: 3, maxLength: 32, pattern: '[A-Za-z0-9_]{3,32}' },
            { name: 'password', label: 'password', type: 'password', autoComplete: 'current-password', minLength: 12, maxLength: 128 },
          ]} />
        <p className="auth-note">The same account signs in on the desktop app’s Link Start card.</p>
      </div>
    </div>
  );
}
