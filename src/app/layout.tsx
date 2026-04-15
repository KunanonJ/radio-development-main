import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";

export const metadata: Metadata = {
  title: "Sonic Bloom",
  description: "Music library and playback — Next.js + Firebase migration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-ui-theme="oled" data-accent="green" suppressHydrationWarning>
      <body className="min-h-[100dvh] font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
