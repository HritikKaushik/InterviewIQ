import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CommandPaletteProvider } from "@/components/command-palette";
import { ThemeProvider } from "@/components/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://interview-iq-steel.vercel.app"),
  title: {
    default: "InterviewIQ - Company-wise LeetCode Questions",
    template: "%s - InterviewIQ",
  },
  description:
    "Explore company-wise LeetCode interview questions with powerful search, filtering, and study tracking.",
  keywords: [
    "leetcode",
    "interview preparation",
    "company-wise questions",
    "coding interview",
    "data structures and algorithms",
  ],
  openGraph: {
    type: "website",
    siteName: "InterviewIQ",
    title: "InterviewIQ - Company-wise LeetCode Questions",
    description:
      "Explore company-wise LeetCode interview questions with powerful search, filtering, and study tracking.",
  },
  twitter: {
    card: "summary_large_image",
    title: "InterviewIQ - Company-wise LeetCode Questions",
    description:
      "Explore company-wise LeetCode interview questions with powerful search, filtering, and study tracking.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111214" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
            >
              Skip to content
            </a>
            <CommandPaletteProvider>{children}</CommandPaletteProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
