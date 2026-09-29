import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'HR-NET AI CINEMA', description: 'AI video scene generator with continuity locks' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="id"><body>{children}</body></html>;
}
