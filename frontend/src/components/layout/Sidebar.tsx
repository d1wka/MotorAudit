"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/",              label: "Dashboard" },
  { href: "/replacement",   label: "Motor Replacement" },
  { href: "/vfd",           label: "VFD Savings" },
  { href: "/power-quality", label: "Power Quality" },
  { href: "/simulation",    label: "EV Simulation" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-navy-500 text-white flex flex-col shrink-0" style={{ backgroundColor: "#1e3a5f" }}>
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-xl font-bold tracking-tight">MotorAudit</div>
        <div className="text-xs text-blue-200 mt-0.5">Energy Audit Platform</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-white/20 text-white"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/10 text-xs text-blue-300">
        <p>IEC 60034-30-1:2014</p>
        <p className="mt-0.5">IEEE 519-2022 thresholds</p>
      </div>
    </aside>
  );
}
