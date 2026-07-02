"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, Home, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/members", label: "Members", icon: UsersRound },
  { href: "/dashboard#payments", label: "Payments", icon: CreditCard },
  { href: "/dashboard#reports", label: "Reports", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 border-r border-black/10 bg-[#17211c] p-5 text-white lg:block">
      <Link href="/" className="flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="TrackCOOP logo"
          width={40}
          height={40}
          className="rounded-md"
        />
        <span className="text-xl font-semibold">TrackCOOP</span>
      </Link>
      <nav className="mt-10 grid gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white",
                isActive && "bg-white text-[#17211c] hover:bg-white hover:text-[#17211c]",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
