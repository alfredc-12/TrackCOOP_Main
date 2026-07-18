import { rentalApiRepository } from "./rentalApi";
import { rentalLocalRepository } from "./rentalLocalRepository";

// Replace demo repository with the TrackCOOP Express API by configuring NEXT_PUBLIC_API_BASE_URL.
export const rentalRepository = process.env.NEXT_PUBLIC_API_BASE_URL
  ? rentalApiRepository
  : rentalLocalRepository;

export const rentalRepositoryMode = process.env.NEXT_PUBLIC_API_BASE_URL ? "api" : "demo";
