import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "PersonaLab AI — Directional research", description: "Evidence-calibrated synthetic research." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
