import { Manrope, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Manrope({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-manrope" });
const text = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-plex-mono" });

export const metadata = { title: "MediLens — Is this medicine genuine?", description: "Photo scan, batch and expiry check, GREEN/AMBER/RED screening verdict. Screening only, not medical advice." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${mono.variable}`}>
      <body>
        <header className="topbar">
          <div className="topbar-in">
            <a className="brand" href="/">
              <span className="brand-mark" aria-hidden="true">M</span>
              Medi<em>Lens</em>
              <span className="brand-tablets" aria-hidden="true">
                <span className="tablet tablet-1" />
                <span className="tablet tablet-2" />
              </span>
            </a>
            <nav>
              <a href="#scanner">Scan</a>
              <a href="#how">How it works</a>
              <a href="#verdicts">Verdicts</a>
              <a className="btn btn-primary" href="#scanner" style={{ padding: "9px 16px" }}>Scan a medicine</a>
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
