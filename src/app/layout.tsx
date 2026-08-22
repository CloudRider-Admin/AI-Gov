import type { Metadata } from "next";
import { Space_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Header, AppShell } from "@/components/layout";
import { Providers } from "@/components/layout/Providers";
import { ThemeProvider } from "@/context";
import { MouseSpotlight } from "@/components/ui/MouseSpotlight";
import { ScrollReveal } from "@/components/layout/ScrollReveal";

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AI GovSecure | Confident AI, Controlled Risk",
    template: "%s | GovSecure",
  },
  description:
    "GovSecure helps small businesses assess AI use cases, create practical policies, and reduce compliance risk — without enterprise complexity or outside consultants.",
  keywords: [
    "AI governance",
    "AI risk management",
    "NIST AI RMF",
    "ISO 42001",
    "EU AI Act",
    "SMB AI compliance",
    "AI policy",
    "responsible AI",
  ],
  authors: [{ name: "GovSecure" }],
  creator: "GovSecure",
  publisher: "GovSecure",
  metadataBase: new URL("https://www.govsecure.ai"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.govsecure.ai",
    siteName: "GovSecure",
    title: "GovSecure | Confident AI, Controlled Risk",
    description:
      "GovSecure helps small businesses assess AI use cases, create practical policies, and reduce compliance risk — without enterprise complexity or outside consultants.",

      images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "GovSecure - Confident AI, Controlled Risk",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GovSecure | Confident AI, Controlled Risk",
    description:
      "The leading AI governance platform for small and mid-sized businesses.",
    images: ["/og-image.svg"],
    creator: "@govsecure",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // verification: { google: "ADD_REAL_CODE_HERE" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${inter.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen bg-terminal-black transition-colors duration-300" suppressHydrationWarning>
        {/*
          Bypass block (WCAG 2.4.1 / Section 508). Every page puts the sidebar
          and header nav ahead of the content, so a keyboard or screen-reader
          user otherwise tabs through the whole navigation on every route.
          Visually hidden until focused.
        */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-terminal-green focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:font-bold focus:text-terminal-black"
        >
          Skip to main content
        </a>
        <Providers>
          <ScrollReveal />
          <ThemeProvider>
            <div className="relative">
              {/* Grid background with mouse spotlight */}
              <MouseSpotlight />

              {/* Header */}
              <Header />

              {/* Sidebar (authenticated) + main content */}
              <AppShell>{children}</AppShell>
            </div>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
