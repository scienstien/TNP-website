"use client";

import { useActionState, useId, useState } from "react";
import {
  signInAction,
  signUpAction,
  type AuthFormState,
} from "@/lib/auth/actions";

type Mode = "signin" | "signup";

const COPY: Record<Mode, { title: string; intro: string }> = {
  signin: {
    title: "Welcome back.",
    intro: "Sign in to explore MME placement records.",
  },
  signup: {
    title: "Get started.",
    intro: "Create a faculty account with read-only access.",
  },
};

export default function AuthForms({ callbackUrl }: { callbackUrl: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const id = useId();

  return (
    <>
      <h1 id="login-title">{COPY[mode].title}</h1>
      <p className="login-intro">{COPY[mode].intro}</p>

      <div
        className="login-tabs"
        role="tablist"
        aria-label="Sign in or create an account"
      >
        {(["signin", "signup"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`${id}-${tab}-tab`}
            aria-selected={mode === tab}
            aria-controls={`${id}-${tab}-panel`}
            tabIndex={mode === tab ? 0 : -1}
            className="login-tab"
            onClick={() => setMode(tab)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                const next = tab === "signin" ? "signup" : "signin";
                setMode(next);
                document.getElementById(`${id}-${next}-tab`)?.focus();
              }
            }}
          >
            {tab === "signin" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${id}-${mode}-panel`}
        aria-labelledby={`${id}-${mode}-tab`}
      >
        {mode === "signin" ? (
          <SignInForm callbackUrl={callbackUrl} />
        ) : (
          <SignUpForm callbackUrl={callbackUrl} />
        )}
      </div>
    </>
  );
}

function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signInAction,
    {},
  );
  return (
    <form action={action} className="login-form" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <Field
        name="email"
        label="Email address"
        type="email"
        autoComplete="username"
        placeholder="Enter your email"
        defaultValue={state.values?.email}
      />
      <PasswordField
        name="password"
        label="Password"
        autoComplete="current-password"
        placeholder="Enter your password"
      />
      <Submit pending={pending} idle="Sign in" busy="Signing in…" />
      {state.error && (
        <p className="login-message" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function SignUpForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signUpAction,
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="login-form" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <Field
        name="name"
        label="Full name"
        autoComplete="name"
        placeholder="Enter your full name"
        defaultValue={state.values?.name}
        error={errors.name}
      />
      <Field
        name="email"
        label="Institute email"
        type="email"
        autoComplete="email"
        placeholder="you@nitt.edu"
        defaultValue={state.values?.email}
        error={errors.email}
      />
      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
        placeholder="Create a password"
        hint="At least 8 characters, with letters and numbers."
        error={errors.password}
      />
      <PasswordField
        name="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
        placeholder="Re-enter your password"
        error={errors.confirmPassword}
      />
      <Submit
        pending={pending}
        idle="Create account"
        busy="Creating account…"
      />
      {state.error && (
        <p className="login-message" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  autoComplete: string;
  placeholder: string;
  defaultValue?: string;
  error?: string;
}

function Field({
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  defaultValue,
  error,
}: FieldProps) {
  const id = useId();
  return (
    <div className="login-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="login-fieldError">
          {error}
        </p>
      )}
    </div>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
  placeholder,
  hint,
  error,
}: Omit<FieldProps, "type" | "defaultValue"> & { hint?: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="login-field">
      <label htmlFor={id}>{label}</label>
      <div className="login-passwordControl">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          maxLength={128}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
        />
        <button
          type="button"
          className="login-passwordToggle"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="login-fieldError">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="login-fieldHint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function Submit({
  pending,
  idle,
  busy,
}: {
  pending: boolean;
  idle: string;
  busy: string;
}) {
  return (
    <button
      type="submit"
      className="login-submit"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? busy : idle}
      {pending ? (
        <span className="login-spinner" aria-hidden="true" />
      ) : (
        <span className="login-submitArrow" aria-hidden="true">
          ↗
        </span>
      )}
    </button>
  );
}

