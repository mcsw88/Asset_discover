import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bookmark PWA',
  description: 'Share payload tester',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Bookmark" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="theme-color" content="#3b82f6" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
