import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { WalletProvider } from "@/contexts/WalletProvider";

export const metadata: Metadata = {
  title: "HiddenHand - Privacy Poker on Solana",
  description: "The only poker game where the house can't see your cards.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://plugin.jup.ag/plugin-v1.js"
          strategy="beforeInteractive"
          data-preload
          defer
        />
      </head>
      <body className="antialiased">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
