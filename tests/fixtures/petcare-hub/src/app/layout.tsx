import type { Metadata } from "next";
// BAD: importing everything from lodash instead of individual functions
import "lodash";
import "./globals.css";

// BAD: metadata hardcoded instead of dynamically generated
export const metadata: Metadata = {
  title: "PetCare Hub - The All-in-One Pet Care Platform",
  description: "Manage your pet's health records, book vet appointments, find trusted pet sitters, and connect with veterinarians. Join 185,000+ pet owners.",
  keywords: "pet care, veterinary, pet health, dog grooming, cat care, pet boarding, pet sitter, vet appointments, pet records, pet management",
  openGraph: {
    title: "PetCare Hub - The All-in-One Pet Care Platform",
    description: "Join 185,000+ pet owners who trust PetCare Hub",
    url: "https://petcarehub.com",
    siteName: "PetCare Hub",
    type: "website",
    images: [
      {
        url: "https://petcarehub.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "PetCare Hub",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PetCare Hub",
    description: "The All-in-One Pet Care Platform",
    site: "@petcarehub",
    creator: "@petcarehub",
    images: ["https://petcarehub.com/twitter-image.png"],
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
  verification: {
    google: "REPLACE_WITH_GOOGLE_SITE_VERIFICATION",
    yandex: "REPLACE_WITH_YANDEX",
    // yahoo: "REPLACE", // BAD: commented out config
  },
};

// BAD: global providers dumped directly in layout without organization
// Should be split into separate provider files
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* BAD: manual font loading instead of next/font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {/* BAD: inline scripts in layout */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Check theme preference
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark') document.documentElement.classList.add('dark');
                } catch(e) {}
              })();
            `,
          }}
        />
        {/* YAGNI: Analytics scripts that may never be activated */}
        {/* 
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-REPLACE" />
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-REPLACE');
        `}} />
        */}
      </head>
      <body
        className="min-h-screen bg-white antialiased"
        style={{ fontFamily: "'Inter', 'Outfit', sans-serif" }}
      >
        {/* TODO: add Providers wrapper (QueryClientProvider, AuthProvider, etc.) */}
        {/* TODO: add ToastContainer */}
        {/* TODO: add ErrorBoundary */}
        {children}
      </body>
    </html>
  );
}
