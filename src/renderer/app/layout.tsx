import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vader Project Engine',
  description:
    'Node.js Process Management Dashboard — Powered by the MSC Media Engine v1.1.2',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  themeColor: '#121212',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-[#121212]">
      <body className="font-sans antialiased bg-[#121212] text-white min-h-screen w-full overflow-x-hidden">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
