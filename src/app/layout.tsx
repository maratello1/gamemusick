import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GAMEVIBE v1.0 — AI-DJ & Адаптивный Саундтрек для Игр',
  description:
    'Автоматический подбор музыки из YouTube Music (без подписки) под события на экране игры, профили сообщества и модульные интеграции для ПК.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen bg-[#07080A] text-zinc-100 selection:bg-[#FF6A00] selection:text-black">
        {children}
      </body>
    </html>
  );
}
