import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'cyrillic-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'GAMEVIBE v2.0 — AI Sound Director & Adaptive Gaming OST',
  description:
    'Нативное десктоп-приложение с 50 Гц Rust-сенсором для автоматической адаптации музыки под события и сцены в любой ПК-игре.',
  icons: {
    icon: '/logo-icon.svg',
    shortcut: '/icon.ico',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${jakarta.variable} ${jetbrains.variable} dark`}>
      <body className="bg-[#060709] text-[#F4F5F8] font-sans antialiased selection:bg-[#FF6A00] selection:text-black overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
