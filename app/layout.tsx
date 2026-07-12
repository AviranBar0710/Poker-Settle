import type { Metadata, Viewport } from "next"
import "./globals.css"
import "./theme.css"
import { AuthProvider } from "@/contexts/AuthContext"
import { UIStateProvider } from "@/contexts/UIStateContext"
import { ClubProvider } from "@/contexts/ClubContext"
import { AuthGuard } from "@/components/AuthGuard"
import { OnboardingGuard } from "@/components/OnboardingGuard"
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: "Poker Settlement App",
  description: "Poker cash-game settlement application",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {/* Apply saved theme before paint — avoids a dark→light flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var t = localStorage.getItem('theme');
    var light = t === 'light' || (t === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
    var el = document.documentElement;
    el.classList.toggle('light', light);
    el.classList.toggle('dark', !light);
  } catch (e) {}
})();
            `.trim(),
          }}
        />
        {/* Catch "Load failed" / AuthRetryableFetchError before React mounts - prevents Next.js overlay */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  var isLoadFailed = function(err) {
    if (!err) return false;
    var msg = (err.message || err.error_description || err.error && err.error.message || String(err || '')).toLowerCase();
    var name = (err.name || '').toString();
    return name === 'AuthRetryableFetchError' || msg === 'load failed' || msg === 'failed to fetch' || msg.indexOf('load failed') >= 0;
  };
  window.addEventListener('unhandledrejection', function(ev) {
    if (isLoadFailed(ev.reason)) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      console.warn('[Auth] Network fetch failed, proceeding without session');
    }
  }, true);
})();
            `.trim(),
          }}
        />
        <AuthProvider>
          <ClubProvider>
            <UIStateProvider>
              <AuthGuard>
                <OnboardingGuard>{children}</OnboardingGuard>
              </AuthGuard>
            </UIStateProvider>
          </ClubProvider>
        </AuthProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
