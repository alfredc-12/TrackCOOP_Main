"use client";

import { RentalErrorState } from "./_components/RentalStates";

export default function RentalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="p-6"><RentalErrorState message={error.message} retry={reset} /></div>;
}
