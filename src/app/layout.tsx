import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RevTime - Daily Revision Tracker",
  description: "Track your daily revision sessions and stay on top of your study goals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
