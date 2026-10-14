import type { Metadata } from 'next';
import './globals.css';
import { AdminStoreProvider } from '@/store/provider';

export const metadata: Metadata = {
  title: 'Brandly Admin',
  description: 'Brandly marketplace operations console',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><AdminStoreProvider>{children}</AdminStoreProvider></body>
    </html>
  );
}
