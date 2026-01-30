import type { Metadata, Viewport } from "next"
import "./globals.css"
import { AuthProvider } from "@/contexts/AuthContext"
import { UIStateProvider } from "@/contexts/UIStateContext"
import { ClubProvider } from "@/contexts/ClubContext"
import { AuthGuard } from "@/components/AuthGuard"
import { OnboardingGuard } from "@/components/OnboardingGuard"

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
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <ClubProvider>
            <UIStateProvider>
              <AuthGuard>
                <OnboardingGuard>{children}</OnboardingGuard>
              </AuthGuard>
            </UIStateProvider>
          </ClubProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
