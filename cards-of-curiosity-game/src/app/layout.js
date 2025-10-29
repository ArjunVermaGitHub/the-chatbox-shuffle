import { Geist, Geist_Mono } from "next/font/google";
import "./globals.scss";
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from '@/components/Providers';
import { Navigation } from '@/components/Navigation';
import AppWithSplash from '@/components/AppWithSplash';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <Providers>
        <html lang="en">
          <head>
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  (function() {
                    const darkMode = localStorage.getItem('darkMode') === 'true';
                    if (darkMode) {
                      document.documentElement.classList.add('dark-mode');
                    } else {
                      document.documentElement.classList.remove('dark-mode');
                    }
                  })();`,
              }}
            />
          </head>
          <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            style={{ 
              height: '100vh', 
              display: 'flex', 
              flexDirection: 'column',
              margin: 0,
              padding: 0
            }}
          >
            <AppWithSplash>
              <Navigation />
              <main className="main-content" style={{ flex: 1, overflow: 'hidden' }}>
                {children}
              </main>
            </AppWithSplash>
          </body>
        </html>
      </Providers>
    </ClerkProvider>
  );
}
