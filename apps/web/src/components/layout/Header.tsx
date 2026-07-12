import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-[#f7f8f3]/90 px-5 py-4 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#657169]">Cooperative desk</p>
          <h1 className="text-2xl font-semibold tracking-normal">Operations</h1>
        </div>
        <div className="hidden w-full max-w-sm md:block">
          <Input
            aria-label="Search"
            placeholder="Search members, payments, documents"
            className="pl-9"
          />
          <Search className="-mt-8 ml-3 size-4 text-[#78837c]" />
        </div>
        <div className="flex items-center gap-3">
          <button
            aria-label="Notifications"
            className="grid size-10 place-items-center rounded-md border border-black/10 bg-white"
          >
            <Bell className="size-4" />
          </button>
          <Link
            href="/login"
            className="rounded-md bg-[#17211c] px-4 py-2 text-sm font-semibold text-white"
          >
            Admin
          </Link>
        </div>
      </div>
    </header>
  );
}
