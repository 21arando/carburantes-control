import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arando Ramos Brayan Rodrigo Petrol - Control Inteligente de Carburantes",
  description: "Plataforma de gestión de inventarios y despacho controlado de gasolina y diésel con algoritmo de cupos dinámicos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
