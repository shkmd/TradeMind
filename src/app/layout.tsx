import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TradeMind India",
  description:
    "India-first multi-broker portfolio, trading-journal, behavioural-risk and performance-intelligence platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning on body: browser extensions (Grammarly,
          password managers, etc.) inject attributes like data-gr-ext-installed
          into <body> before React hydrates, which is a benign false-positive
          mismatch — not an app bug. See https://nextjs.org/docs/messages/react-hydration-error */}
      <body className={`${inter.variable} ${sourceSerif.variable} font-sans`} suppressHydrationWarning>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
