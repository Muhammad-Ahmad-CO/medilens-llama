export const metadata = { title: "MediLens — Hackathon MVP", description: "Photo scan, batch and expiry check, GREEN/AMBER/RED screening verdict. Screening only, not medical advice." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "0 auto", padding: 20 }}>
        {children}
        <p style={{ fontSize: 13, color: "#555", marginTop: 32 }}>
          Built with Meta Muse models for the Meta Global AI Developer Hackathon (Indie track, Build for Your World).
          Screening only — not medical advice. If in doubt, show the pack to a pharmacist.
        </p>
      </body>
    </html>
  );
}
