import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Frame } from "@/components/Nav";
import { readSession } from "@/lib/shopify-session";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const serif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Haggly",
  description: "Connect Shopify. Haggly runs the ads, protects margin, and watches stock.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const connected = Boolean(await readSession());
  return (
    <html
      lang="en"
      className={`${display.variable} ${serif.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Frame connected={connected}>{children}</Frame>
      </body>
    </html>
  );
}
