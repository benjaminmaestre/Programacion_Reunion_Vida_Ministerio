import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vida y Ministerio | Gestión de asignaciones",
  description: "Gestión del directorio, historial y preparación del programa Vida y Ministerio Cristianos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
