'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { FormState } from '../actions';

type Field = { name: string; label: string; type?: 'text' | 'password'; autoComplete: string; minLength?: number; maxLength: number; pattern?: string; hint?: string };

/** The blue Link Start system card as a working form. */
export function SystemForm({ title, lang, fields, submit, pending, action, alternate }: {
  title: string; lang?: string; fields: Field[]; submit: string; pending: string;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  alternate: { href: string; label: string };
}) {
  const [state, formAction, busy] = useActionState(action, null);
  return (
    <form className="system-card" action={formAction} aria-labelledby="system-title">
      <h1 id="system-title" className="system-title" lang={lang}>{title}</h1>
      {fields.map(field => (
        <div key={field.name}>
          <label className="system-label" htmlFor={field.name}>:{field.label}</label>
          <input id={field.name} name={field.name} className="system-input" type={field.type ?? 'text'} autoComplete={field.autoComplete}
            required minLength={field.minLength} maxLength={field.maxLength} pattern={field.pattern} spellCheck={false} autoCapitalize="none"
            aria-describedby={field.hint ? `${field.name}-hint` : undefined} />
          {field.hint && <p id={`${field.name}-hint`} className="system-hint">{field.hint}</p>}
        </div>
      ))}
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
      <div className="system-actions">
        <button className="pill selected" type="submit" disabled={busy}>{busy ? pending : submit}</button>
        <Link className="system-link" href={alternate.href}>{alternate.label}</Link>
      </div>
    </form>
  );
}
