import { Nunito } from "next/font/google";
import "./globals.scss";
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from '@/components/Providers';
import AppFlow from '@/components/AppFlow';

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
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
            className={`${nunito.variable} antialiased`}
            style={{ 
              height: '100vh', 
              display: 'flex', 
              flexDirection: 'column',
              margin: 0,
              padding: 0,
              fontFamily: 'var(--font-nunito), sans-serif'
            }}
          >
            <AppFlow>
              <main className="main-content" style={{ flex: 1, overflow: 'hidden' }}>
                {children}
              </main>
            </AppFlow>
          </body>
        </html>
      </Providers>
    </ClerkProvider>
  );
}
