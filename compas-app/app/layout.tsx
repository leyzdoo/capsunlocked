import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compás",
  description: "Coparenting logistics, unstuck from Google Apps Script.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
