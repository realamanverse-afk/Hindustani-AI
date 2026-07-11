import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hindustani AI IN - by Aman Developers',
  description: 'Desi AI Assistant with Voice, Image & PDF Export',
  manifest: '/manifest.json',
  themeColor: '#FF9933',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
