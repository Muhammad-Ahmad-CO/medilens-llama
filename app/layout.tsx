import { Manrope, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Manrope({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-manrope" });
const text = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-plex-mono" });

export const metadata = { title: "MediLens — Is this medicine genuine?", description: "Photo scan, batch and expiry check, GREEN/AMBER/RED screening verdict. Screening only, not medical advice.", icons: { icon: "/logo.svg" } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${mono.variable}`}>
      <body>
        <header className="topbar">
          <div className="topbar-in">
            <a className="brand" href="/">
              <span className="brand-mark" aria-label="MediLens logo">
                <svg viewBox="0 0 48 48" aria-hidden="true">
                  <circle cx="22" cy="22" r="17" fill="#ffffff" stroke="#0E7A5F" strokeWidth="4" />
                  <g transform="rotate(-35 22 22)">
                    <path d="M22 18.5 H15.5 A3.5 3.5 0 0 0 15.5 25.5 H22 Z" fill="#0E7A5F" />
                    <rect x="12" y="18.5" width="20" height="7" rx="3.5" fill="none" stroke="#0E7A5F" strokeWidth="2" />
                  </g>
                  <circle cx="36" cy="36" r="8" fill="#0E7A5F" stroke="#ffffff" strokeWidth="2" />
                  <path d="M32.5 36 L35 38.5 L39.5 33.5" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              Medi<em>Lens</em>
              <span className="brand-tablets" aria-hidden="true">
                <span className="tablet tablet-1" />
                <span className="tablet tablet-2" />
              </span>
            </a>
            <nav>
              <a href="/#scanner">Scan</a>
              <a href="/#how">How it works</a>
              <a href="/#verdicts">Verdicts</a>
              <a href="/cabinet">Cabinet</a>
              <a className="btn btn-primary" href="/#scanner" style={{ padding: "9px 16px" }}>Scan a medicine</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="footer">
          <div className="wrap">
            <p style={{ margin: 0 }}>
              <strong>MediLens</strong> — medicine authenticity checker. Built with Meta Muse models for the
              Meta Global AI Developer Hackathon (Indie track, Build for Your World).
            </p>
            <p className="small" style={{ margin: "8px 0 0" }}>
              Screening only, not medical advice. A GREEN result does not prove a pack is genuine.
              If in doubt, show the pack to a pharmacist before use.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
