import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VerifyOne - Phone, Email & IP Validation API',
  description: 'Validate phone, email & IP in real time. One API, one credit balance. 7-day free trial.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
