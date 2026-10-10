import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const ui = Instrument_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Reunión Vida y Ministerio Cristianos | Gestión de asignaciones",
  description: "Gestión del directorio, historial y preparación del programa Vida y Ministerio Cristianos.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className={`${ui.variable} ${serif.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
