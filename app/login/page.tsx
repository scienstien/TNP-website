"use client";

import Image from "next/image";
import { useEffect, useRef, useSyncExternalStore } from "react";
import LoginLogo from "@/components/login/LoginLogo";
import TnpTitle from "@/components/login/TnpTitle";
import orionBackground from "@/components/login-form-background/orionimage.png";
import AuthForms from "./AuthForms";
import "./login.css";

const subscribeToSearch = () => () => {};

export default function LoginPage() {
  const search = useSyncExternalStore(
    subscribeToSearch,
    () => window.location.search,
    () => "",
  );
  const params = new URLSearchParams(search);
  const callbackUrl = toSameOriginPath(params.get("callbackUrl"));
  return (
    <main className="login-page">
      <section className="login-formSection" aria-labelledby="login-title">
        <Starfield className="login-formStars" />
        <div className="login-formBackdrop" aria-hidden="true">
          <Image
            src={orionBackground}
            alt=""
            fill
            sizes="(max-width: 800px) 100vw, 45vw"
          />
        </div>
        <header className="login-brand">
          <LoginLogo className="login-logo" />
          <span className="login-brandDivider" aria-hidden="true" />
          <TnpTitle
            as="span"
            useDisplayFont={false}
            autoIntervalMs={0}
            className="login-brandTitle"
          />
          <span className="login-institute">
            NIT TRICHY
            <span className="login-department">
              METALLURGICAL &amp; MATERIALS ENGINEERING
            </span>
          </span>
        </header>

        <div className="login-formContent">
          <AuthForms callbackUrl={callbackUrl} />
        </div>
        <p className="login-footer">MME Training &amp; Placement · NIT Trichy</p>
      </section>

      <section
        className="login-hero"
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
        <Starfield />
        <div className="login-heroCopy">
          <span className="login-heroRule" aria-hidden="true" />
          <p className="login-heroEyebrow">NITT</p>
          <p className="login-heroTagline">
            The Pride of India
          </p>
        </div>
      </section>
    </main>
  );
}

function Starfield({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stars = Array.from({ length: window.innerWidth < 700 ? 90 : 260 }, () => ({
      x: Math.random(), y: Math.random(), radius: Math.random() * 1.2 + 0.25,
      alpha: Math.random() * 0.65 + 0.2, phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.0008 + 0.00025,
      color: Math.random() < 0.08 ? "#82b7ff" : Math.random() < 0.06 ? "#ffd08a" : "#fff",
    }));
    let frame = 0;
    let width = 0;
    let height = 0;
    let pointerX = 0;
    let pointerY = 0;
    const shootingStart = Math.random() * 130000 + 50000;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const move = (event: PointerEvent) => {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 12;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 8;
    };
    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        const twinkle = reduced.matches ? 1 : 0.76 + Math.sin(time * star.speed + star.phase) * 0.24;
        const x = star.x * width + pointerX * star.radius;
        const y = star.y * height + pointerY * star.radius;
        const fade = Math.max(0, Math.min(1, (x / width - 0.08) / 0.8));
        context.globalAlpha = star.alpha * twinkle * fade;
        context.fillStyle = star.color;
        context.beginPath();
        context.arc(x, y, star.radius, 0, Math.PI * 2);
        context.fill();
      }
      if (!reduced.matches && time % 180000 > shootingStart && time % 180000 < shootingStart + 900) {
        const progress = (time % 180000 - shootingStart) / 900;
        context.globalAlpha = 0.7 * (1 - progress);
        context.strokeStyle = "#d9e8ff";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(width * (0.62 + progress * 0.12), height * (0.12 + progress * 0.12));
        context.lineTo(width * (0.58 + progress * 0.12), height * (0.08 + progress * 0.12));
        context.stroke();
      }
      context.globalAlpha = 1;
      if (!reduced.matches) frame = requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    draw(0);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
    };
  }, []);

  return <canvas ref={canvasRef} className={`login-starfield ${className}`} aria-hidden="true" />;
}

/** Where to go after signing in: a same-site path only (the server re-checks this). */
function toSameOriginPath(value: string | null): string {
  if (!value || typeof window === "undefined") return "/";
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}`
      : "/";
  } catch {
    return "/";
  }
}
