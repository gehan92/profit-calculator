import { ImageResponse } from "next/og";
import { openGraphImage } from "@/config/site";
import { routing } from "@/i18n/routing";

/**
 * The picture shown when a link is shared on WhatsApp or Facebook (Part F4.5).
 * It lives in `[locale]` so every page below inherits it (/en/opengraph-image...).
 *
 * English only, on purpose: the image engine (Satori) cannot join Sinhala
 * and Tamil letters correctly, so those words would look broken. The page
 * title and description under the picture are still in the page's language.
 */
/** Build the image once per language at build time instead of on every request. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const alt = openGraphImage.alt;
export const size = { width: openGraphImage.width, height: openGraphImage.height };
export const contentType = "image/png";

/** Part E1 colours. */
const COLORS = {
  primary: "#0F766E",
  primarySoft: "#CCFBF1",
  profit: "#16A34A",
  profitDark: "#15803D",
  text: "#0F172A",
  muted: "#64748B",
  card: "#F8FAFC",
};

const EXAMPLE_ROWS = [
  ["Sales today", "Rs 25,000"],
  ["Stock bought", "Rs 15,000"],
  ["Other costs", "Rs 1,500"],
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 48,
          padding: "72px 72px",
          background: `linear-gradient(135deg, #FFFFFF 40%, ${COLORS.primarySoft} 100%)`,
          fontFamily: "sans-serif",
        }}
      >
        {/* Left: brand and promise */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: COLORS.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 7h6v6" />
                <path d="m22 7-8.5 8.5-5-5L2 17" />
              </svg>
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: COLORS.text }}>Profit Calculator</div>
          </div>

          <div
            style={{
              fontSize: 58,
              fontWeight: 800,
              lineHeight: 1.1,
              color: COLORS.text,
              letterSpacing: -1.5,
            }}
          >
            Know your real profit in 10 seconds.
          </div>

          <div style={{ fontSize: 28, color: COLORS.muted }}>
            Free for small shops. No signup.
          </div>
        </div>

        {/* Right: example result card (Part A5, scenario 1) */}
        <div
          style={{
            width: 430,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            padding: 32,
            borderRadius: 28,
            background: "#FFFFFF",
            boxShadow: "0 24px 60px rgba(15, 118, 110, 0.18)",
          }}
        >
          {EXAMPLE_ROWS.map(([label, value]) => (
            <div
              key={label}
              style={{ display: "flex", justifyContent: "space-between", fontSize: 24 }}
            >
              <span style={{ color: COLORS.muted }}>{label}</span>
              <span style={{ color: COLORS.text, fontWeight: 600 }}>{value}</span>
            </div>
          ))}
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              padding: 22,
              borderRadius: 18,
              background: "#DCFCE7",
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 700, color: COLORS.profitDark, letterSpacing: 1 }}>
              PROFIT
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontSize: 50, fontWeight: 800, color: COLORS.profit, whiteSpace: "nowrap" }}>
                Rs 8,500
              </span>
              <span style={{ fontSize: 28, fontWeight: 700, color: COLORS.profitDark }}>34%</span>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
