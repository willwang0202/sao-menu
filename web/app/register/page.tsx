import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SystemForm } from '../components/system-form';
import { register } from '../actions';
import { sessionToken } from '@/lib/session';
import '../components/auth.css';

export const metadata: Metadata = { title: 'Create an account' };

export default async function RegisterPage() {
  if (await sessionToken()) redirect('/account');
  return (
    <div className="auth-room">
      <div>
        <SystemForm title="キャラクター登録" lang="ja" submit="Create" pending="Creating…" action={register} alternate={{ href: '/login', label: 'I already have an account' }}
          fields={[
            { name: 'username', label: 'account', autoComplete: 'username', minLength: 3, maxLength: 32, pattern: '[A-Za-z0-9_]{3,32}', hint: '3–32 letters, numbers or underscores. Friends find you by this.' },
            { name: 'displayName', label: 'player name', autoComplete: 'nickname', maxLength: 40, hint: 'Shown to friends, up to 40 characters.' },
            { name: 'password', label: 'password', type: 'password', autoComplete: 'new-password', minLength: 12, maxLength: 128, hint: 'At least 12 characters.' },
          ]} />
        <p className="auth-note">Character registration. Use this account in the desktop app and here.</p>
      </div>
    </div>
  );
}
