import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import Rahmen from "./Rahmen";

const outfit = Outfit({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Immobil - Wohnungssuche am ÖPNV",
  description: "Finde Wohnungen und Häuser in ganz Deutschland nach ÖPNV-Anbindung.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${outfit.className} antialiased min-h-screen flex flex-col bg-zinc-50 text-zinc-900`}>
        <Rahmen>{children}</Rahmen>
      </body>
    </html>
  );
}