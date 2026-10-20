"use client";

import Image from "next/image";
import { gsap } from "gsap";
import {
  Cinzel,
  IBM_Plex_Sans,
  Playfair_Display,
  Roboto_Condensed,
} from "next/font/google";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import LoginLogo from "@/components/login/LoginLogo";
import TnpTitle from "@/components/login/TnpTitle";
import orionBackground from "@/components/login-form-background/orionimage.png";
import "./login.css";

const heroSerif = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-login-serif",
});
const heroSans = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-login-condensed",
});
const heroPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-login-plex",
});
const heroCinzel = Cinzel({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-login-cinzel",
});

type WordmarkFont = "cinzel" | "condensed" | "plex" | "geometric";
const subscribeToSearch = () => () => {};

export default function LoginPage() {
  const glintLetterRef = useRef<HTMLSpanElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const search = useSyncExternalStore(
    subscribeToSearch,
    () => window.location.search,
    () => "",
  );
  const params = new URLSearchParams(search);
  const isNittPreview = params.get("heroWordmark") === "nitt";
  const heroWordmark = isNittPreview ? "NITT" : "NIT TRZ";
  const requestedFont = params.get("heroFont");
  const wordmarkFont: WordmarkFont =
    requestedFont === "cinzel" ||
    requestedFont === "condensed" ||
    requestedFont === "plex" ||
    requestedFont === "geometric"
      ? requestedFont
      : isNittPreview
        ? "condensed"
        : "cinzel";

  useEffect(() => {
    const letter = glintLetterRef.current;
    if (!letter) return;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.set(letter, {
        "--login-glint-opacity": 0,
        "--login-glint-brightness": 1,
      });
      gsap
        .timeline({ delay: 0.3, repeat: -1, repeatDelay: 2.5 })
        .to(letter, {
          "--login-glint-opacity": 1,
          "--login-glint-brightness": 3.5,
          duration: 0.35,
          ease: "power2.out",
        })
        .to(letter, {
          "--login-glint-opacity": 0.85,
          "--login-glint-brightness": 2.2,
          duration: 0.3,
          ease: "sine.inOut",
        })
        .to(letter, {
          "--login-glint-opacity": 0,
          "--login-glint-brightness": 1,
          duration: 0.65,
          ease: "power2.in",
        });
    });

    return () => media.revert();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    // TODO: Connect to the chosen authentication provider.
    // The server must verify credentials and determine the user's role.
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    setError("Sign-in is not connected yet.");
    setIsSubmitting(false);
  }

  return (
    <main className="login-page">
      <section className="login-formSection" aria-labelledby="login-title">
        <div className="login-formBackdrop" aria-hidden="true">
          <Image
            src={orionBackground}
            alt=""
            fill
            sizes="(max-width: 800px) 100vw, 40vw"
          />
        </div>
        <div className="login-brand">
          <span className="login-institute">
            NIT TIRUCHIRAPPALLI
            <span className="login-department">
              METALLURGICAL &amp; MATERIALS ENGINEERING
            </span>
          </span>
        </div>

        <div className="login-formContent">
          <div className="login-identity">
            <LoginLogo className="login-logo" />
            <TnpTitle
              as="span"
              useDisplayFont={false}
              autoIntervalMs={3500}
              className="login-brandTitle"
            />
          </div>
          <h1 id="login-title">Welcome back.</h1>
          <p className="login-intro">
            Sign in to explore MME placement records.
          </p>
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="Enter your email"
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className="login-passwordControl">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="login-passwordToggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="login-submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
              {isSubmitting ? (
                <span className="login-spinner" aria-hidden="true" />
              ) : (
                <span className="login-submitArrow" aria-hidden="true">
                  ↗
                </span>
              )}
            </button>
            {error && (
              <p className="login-message" role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      </section>

      <section
        className={`login-hero ${heroSerif.variable} ${heroSans.variable} ${heroPlex.variable} ${heroCinzel.variable}`}
        aria-label="Blueprint building illustration"
      >
        <div className={`login-layer login-glow`} aria-hidden="true" />
        <div className={`login-layer login-grid`} aria-hidden="true" />
        <div className={`login-layer login-building`} aria-hidden="true">
          <Image
            src="/login-building.webp"
            alt=""
            width={640}
            height={535}
            unoptimized
            priority
          />
        </div>
        <div className={`login-layer login-vignette`} aria-hidden="true" />
        <div className={`login-layer login-overlay`} aria-hidden="true">
          <svg viewBox="0 0 1672 941" preserveAspectRatio="xMidYMid slice">
            <circle className="login-arc" cx="1250" cy="520" r="640" />
            <circle className="login-ring" cx="730" cy="230" r="8" />
            <g className="login-plus">
              <path d="M1432 66v20M1422 76h20" />
              <path d="M1568 405v20M1558 415h20" />
              <path d="M622 857v20M612 867h20" />
            </g>
          </svg>
        </div>
        <p className="login-heroDetail">TIRUCHIRAPPALLI · EST. 1964</p>
        <div className="login-heroCopy">
          <p
            className={`login-heroWordmark login-heroWordmark--${wordmarkFont}`}
          >
            {heroWordmark}
          </p>
          <p className="login-heroTagline">
            <span>
              the pri
              <span ref={glintLetterRef} className="login-glintLetter">
                d
              </span>
              e
            </span>
            <em>of India.</em>
          </p>
        </div>
      </section>
    </main>
  );
}
