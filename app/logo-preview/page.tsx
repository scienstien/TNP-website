import Link from "next/link";
import LoginLogo from "@/components/login/LoginLogo";
import TnpTitle from "@/components/login/TnpTitle";

export const metadata = {
  title: "Logo preview | MME Training and Placement",
};

export default function LogoPreview() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 overflow-x-clip bg-[#0F0E0D] px-4 py-12 text-center text-[#F3EDE7]">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#C9A98B]">
        NIT Tiruchirappalli
      </p>
      <LoginLogo />
      <TnpTitle className="text-[clamp(1.35rem,5.8vw,3.25rem)]" />
      <p className="max-w-sm text-sm leading-relaxed text-[#A89C90]">
        Move your pointer over the medallion to tilt it. Hover over T&amp;P,
        or tap it on a touch screen, to reveal Training &amp; Placement.
      </p>
      <Link href="/" className="text-sm text-[#C9A98B] underline underline-offset-4">
        Back to dashboard preview
      </Link>
    </main>
  );
}
