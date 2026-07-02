"use client";

import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8f3] px-5">
      <section className="max-w-md rounded-lg border border-black/10 bg-white p-6 text-center">
        <h1 className="text-2xl font-semibold">Something needs attention</h1>
        <p className="mt-3 text-sm leading-6 text-[#657169]">{error.message}</p>
        <Button onClick={reset} className="mt-6">Try again</Button>
      </section>
    </main>
  );
}
