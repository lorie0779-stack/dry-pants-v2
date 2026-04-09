import type { Metadata } from "next";
import { Noto_Sans_TC, Press_Start_2P } from "next/font/google";
import "./globals.css";

const notoSansTc = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto",
});

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

export const metadata: Metadata = {
  title: "Ryder 的乾爽大冒險",
  description: "Dry-Pants Adventure V2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body
        className={`${notoSansTc.variable} ${pressStart.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
