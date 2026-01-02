import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "next-auth/react";
import { SearchProvider } from "@/context/search-context";
import { cn } from "@/lib/utils";
import { NotificationManager } from "@/components/notification-manager";
import { ExpoNotificationManagerWrapper } from "@/components/ExpoNotificationManagerWrapper";
import { DialogModel } from "@/components/modal/global-model";
import Script from "next/script";
import { GA4Tracker } from "@/components/ga4";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Morr Appz",
    default: "Morr Appz",
  },
  description: "created by morr",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale || "en"}  suppressHydrationWarning>
      <head>
         {/* ===== Google Analytics (GA4) ===== */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-62YDHV6JTL"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-62YDHV6JTL', {
              page_path: window.location.pathname,
            });
          `}
        </Script>
      </head>
      <body
        className={cn(geistSans.variable, geistMono.variable, "antialiased")}
      >
        <GA4Tracker /> 
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
            storageKey={undefined}
            themes={["light", "twitter", "green","vercel","neo", "dark-twitter", "dark-green", "dark-root","dark-vercel","dark-neo"]}
          >
            <SearchProvider>
              <SessionProvider>
                <NotificationManager />
                <ExpoNotificationManagerWrapper />
                {children}
              </SessionProvider>
            </SearchProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        <Toaster richColors />
        <DialogModel />
      </body>
    </html>
  );
}
