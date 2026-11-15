import { Inter, Noto_Sans_Sinhala, Noto_Sans_Tamil } from "next/font/google";

/**
 * Fonts from Part E2: Inter for Latin text, Noto Sans for Sinhala and Tamil.
 *
 * Sinhala and Tamil are not preloaded: the browser downloads them only when
 * a page actually shows those letters (unicode-range), keeping English pages
 * light on cheap phones and slow data.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSinhala = Noto_Sans_Sinhala({
  subsets: ["sinhala"],
  variable: "--font-sinhala",
  display: "swap",
  preload: false,
});

const notoTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  variable: "--font-tamil",
  display: "swap",
  preload: false,
});

/** CSS variable classes to put on <html>; globals.css builds `font-sans` from them. */
export const fontVariables = [inter.variable, notoSinhala.variable, notoTamil.variable].join(" ");
