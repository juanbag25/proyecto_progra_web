import type { Metadata, Viewport } from 'next';
import { Outfit, Inter } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fitlist.app';
const SITE_NAME = 'FitList';
const SITE_TAGLINE = 'Tu lista de compras inteligente';
const SITE_DESCRIPTION =
  'Cumplí tus objetivos fitness sin contar calorías. FitList te arma una lista semanal calibrada a tus macros, tu presupuesto y los precios reales de tu super.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    // Per-page titles inject through this template; avoids duplicating
    // "— FitList" suffixes across every page that sets its own metadata.
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'lista de compras',
    'macros',
    'nutrición',
    'fitness',
    'argentina',
    'supermercado',
    'presupuesto',
    'IA',
    'planificación de comidas',
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    // OG image lives in /public/og.png. When absent, social previews fall
    // back to the title + description card from the Open Graph defaults.
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: ['/og.png'],
  },
  robots: {
    // Default: indexable. Per-page overrides (e.g. /app/* sets noindex)
    // handle the private surface area.
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

// `themeColor` and `viewport` belong on the dedicated viewport export per
// Next 14 — moving them here silences the build-time warnings.
export const viewport: Viewport = {
  themeColor: '#0A0F1A',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`dark ${outfit.variable} ${inter.variable}`}>
      <body className="bg-canvas-base font-sans text-white antialiased">{children}</body>
    </html>
  );
}
