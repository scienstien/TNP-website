"use client";

import { useActionState, useId, useState } from "react";
import { signInAction, type AuthFormState } from "@/lib/auth/actions";

export default function AuthForms({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signInAction, {});
  const emailId = useId();
  const passwordId = useId();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <h1 id="login-title">Welcome back.</h1>
      <p className="login-intro">Sign in to explore placement records.</p>
      <form action={action} className="login-form" noValidate>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <div className="login-field">
          <label htmlFor={emailId}>Email or username</label>
          <input id={emailId} name="email" type="text" autoComplete="username" placeholder="Enter your email or username" defaultValue={state.values?.email} required />
        </div>
        <div className="login-field">
          <label htmlFor={passwordId}>Password</label>
          <div className="login-passwordControl">
            <input id={passwordId} name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required maxLength={128} />
            <button type="button" className="login-passwordToggle" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
              {visible ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <button type="submit" className="login-submit" disabled={pending} aria-busy={pending}>
          {pending ? "Signing in…" : "Sign in"}
          {pending ? <span className="login-spinner" aria-hidden="true" /> : <span className="login-submitArrow" aria-hidden="true">↗</span>}
        </button>
        {state.error && <p className="login-message" role="alert">{state.error}</p>}
      </form>
    </>
  );
}
