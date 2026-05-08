import type { Metadata } from "next";
import { Space_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout";
import { Providers } from "@/components/layout/Providers";
import { ThemeProvider } from "@/context";
import { MouseSpotlight } from "@/components/ui/MouseSpotlight";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
        <Providers>
          <ScrollReveal />
          <ThemeProvider>
            <div className="relative">
              {/* Grid background with mouse spotlight */}
              <MouseSpotlight />

              {/* Header */}
              <Header />

              {/* Main content */}
              <ErrorBoundary>
                <main className="relative z-10">{children}</main>
              </ErrorBoundary>
            </div>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
