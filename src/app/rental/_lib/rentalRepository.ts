import { rentalApiRepository } from "./rentalApi";
import { rentalLocalRepository } from "./rentalLocalRepository";

// Uses the local Next.js MySQL API by default. Set NEXT_PUBLIC_RENTAL_DEMO=1 to return to browser-only demo data.
export const rentalRepository = process.env.NEXT_PUBLIC_RENTAL_DEMO === "1"
  ? rentalLocalRepository
  : rentalApiRepository;

export const rentalRepositoryMode = process.env.NEXT_PUBLIC_RENTAL_DEMO === "1" ? "demo" : "api";
