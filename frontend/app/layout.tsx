import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { FlowProvider } from "@/lib/store";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AI Trading Research Assistant",
  description:
    "Turn a natural-language market question into a structured, testable trading experiment. AI-guided research workflow — Ask, Clarify, Define, Test, Learn.",
  keywords: ["trading research", "backtesting", "NIFTY", "quantitative finance", "AI"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <FlowProvider>
          {/* Top bar */}
          <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-zinc-100">
                  AI Trading Research
                </span>
              </div>
              <span className="text-xs text-zinc-600 hidden sm:block">
                Demonstration only — not financial advice
              </span>
            </div>
          </header>

          <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
            {children}
          </main>

          <footer className="border-t border-zinc-800/60 mt-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
              <p className="text-xs text-zinc-600 text-center">
                This tool is for research and demonstration purposes only. Results are based on
                historical or synthetic data and do not constitute financial advice.
              </p>
            </div>
          </footer>
        </FlowProvider>
      </body>
    </html>
  );
}
