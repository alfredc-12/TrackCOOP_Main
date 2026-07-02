import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8f3] px-5 text-center">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#4d8f5b]">
          404
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal">Page not found</h1>
        <Link href="/" className="mt-6 inline-flex">
          <Button>Return home</Button>
        </Link>
      </section>
    </main>
  );
}
