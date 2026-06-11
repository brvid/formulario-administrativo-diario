import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Formulario Administrativo Diario",
  description:
    "Control diario administrativo con nulos, comida personal, caja y cierre",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}