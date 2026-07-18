"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { RentalHeader } from "./RentalHeader";
import { RentalSidebar } from "./RentalSidebar";
import { RentalMobileNavigation } from "./RentalMobileNavigation";
import { RentalPublicHeader } from "./RentalPublicHeader";
import { RentalBreadcrumbs } from "./RentalBreadcrumbs";
import { isPublicRentalPath } from "../_lib/rentalNavigation";

export function RentalModuleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const publicPage = isPublicRentalPath(pathname);
  if (publicPage) return <div className="min-h-dvh w-full bg-[#f8f5eb] text-[#17211c]"><RentalPublicHeader /><main>{children}</main></div>;
  return <div className="flex min-h-dvh w-full bg-[#f8f5eb] text-[#17211c]"><RentalSidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><div className="min-w-0 flex-1"><RentalHeader onMenu={() => setMenuOpen(true)} /><main className="mx-auto max-w-[100rem] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8"><RentalBreadcrumbs />{children}</main></div><RentalMobileNavigation onMore={() => setMenuOpen(true)} /></div>;
}
