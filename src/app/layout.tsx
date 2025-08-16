import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookMe - P2P Booking Platform",
  description: "Connect, share, and book time with the peer-to-peer booking community",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
