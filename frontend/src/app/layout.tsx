import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuditSessionProvider } from "@/hooks/useAuditSession";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MotorAudit — Industrial Motor Energy Audit Platform",
  description: "Replacement payback, VFD sizing, and power quality analysis for industrial electric motors.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuditSessionProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <TopBar />
              <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
                {children}
              </main>
            </div>
          </div>
        </AuditSessionProvider>
      </body>
    </html>
  );
}
