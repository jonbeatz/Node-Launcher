/* eslint-disable @next/next/no-page-custom-font -- v2.0.0 explicit Inter/Noto/Poppins head links for VPE + Electron */
import type { Metadata, Viewport } from 'next'
import './vpe-central-palette.css'
import './globals.css'
import { VpeRootClientShell } from '@/VpeRootClientShell'

const vpeCriticalBlockingCss =
  'html.dark,html[data-theme=dark]{color-scheme:dark}html,body{margin:0;min-height:100%;background:#121212;color:#fafafa}'

export const metadata: Metadata = {
  title: 'Vader Project Engine',
  description:
    'Node.js Process Management Dashboard — MSC Media Engine Station Prime. Ship version is injected at runtime (footer, terminal, and log drawer use the same line).',
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
    <html
      lang="en"
      className="dark bg-[#121212] vpe-theme-font"
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{ __html: vpeCriticalBlockingCss }}
        />
      </head>
      <body
        className="antialiased bg-background text-foreground min-h-screen w-full overflow-x-hidden"
        suppressHydrationWarning
      >
        <VpeRootClientShell>{children}</VpeRootClientShell>
      </body>
    </html>
  )
}
