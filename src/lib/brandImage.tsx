import { ImageResponse } from "next/og";

// The picture WhatsApp, Instagram and others show under a shared GymJourno link (1200 × 630).
// Satori: flexbox only, and every element with more than one child needs display: flex.
export const BRAND_IMAGE_SIZE = { width: 1200, height: 630 };

const ACCENT = "#4f46e5";

export function brandImage({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle: string }): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b0b0d",
          color: "#f4f4f5",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              width: 64,
              height: 64,
              borderRadius: 16,
              background: ACCENT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* The app's dumbbell icon. */}
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.25" strokeLinecap="round">
              <rect x="5.5" y="6.5" width="3" height="11" rx="1.2" />
              <rect x="15.5" y="6.5" width="3" height="11" rx="1.2" />
              <path d="M3 9.5v5M21 9.5v5M8.5 12h7" />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>GymJourno</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {eyebrow && <div style={{ display: "flex", fontSize: 30, color: "#a5b4fc", fontWeight: 600 }}>{eyebrow}</div>}
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 32, color: "#a1a1aa", lineHeight: 1.3 }}>{subtitle}</div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#8b8b95" }}>gymjourno.fit</div>
      </div>
    ),
    BRAND_IMAGE_SIZE,
  );
}
