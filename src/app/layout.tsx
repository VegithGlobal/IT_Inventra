import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "IT Ops Hub", template: "%s · IT Ops Hub" },
  description: "IT assets, subscriptions, expenses and tickets in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${mono.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!rounded-lg !border !border-line !bg-surface !text-fg !shadow-[var(--shadow-popover)] !text-[13.5px]",
          }}
        />
      </body>
    </html>
  );
}
