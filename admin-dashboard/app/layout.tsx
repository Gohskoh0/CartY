import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CartY Admin',
  description: 'CartY Admin Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-navy-950 text-slate-200 antialiased">{children}</body>
    </html>
  );
}
