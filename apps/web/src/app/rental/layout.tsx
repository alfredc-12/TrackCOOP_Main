import type { Metadata } from "next";
import { RentalProvider } from "./_context/RentalProvider";
import { RentalModuleShell } from "./_components/RentalModuleShell";
import "./rental.css";

export const metadata: Metadata = {
  title: "Equipment Rental | TrackCOOP",
  description: "Browse, request, schedule, and manage NFFAC equipment rental services.",
};

export default function RentalLayout({ children }: { children: React.ReactNode }) {
  return <RentalProvider><RentalModuleShell>{children}</RentalModuleShell></RentalProvider>;
}
