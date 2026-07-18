import { CalendarCheck2 } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanRentalBookingsPage() {
  return (
    <PortalRoutePage
      eyebrow="Operations"
      title="Rental Bookings"
      description="Rental requests, schedule conflicts, booking status, and member usage."
      icon={CalendarCheck2}
    />
  );
}
