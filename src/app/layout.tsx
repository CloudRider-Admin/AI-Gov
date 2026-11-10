import type { Metadata } from "next";
import { Space_Mono, Inter, Source_Serif_4 } from "next/font/google";
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

// Display serif for app greetings and headings (signed-in UI).
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
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

// Runs before first paint: applies the saved theme and, for returning signed-in
// users, the app shell class — so neither the theme nor the layout flashes
// while the client session loads. AppShell keeps the hint in sync.
const preloadScript = `try{var d=document.documentElement;var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){d.classList.remove('dark','light');d.classList.add(t);}if(localStorage.getItem('govsecure:authed')==='1'){d.classList.add('app-ui');}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${inter.variable} ${sourceSerif.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preloadScript }} />
      </head>
      <body className="min-h-screen bg-terminal-black transition-colors duration-300" suppressHydrationWarning>
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
