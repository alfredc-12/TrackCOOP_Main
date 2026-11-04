import { RentalServiceBrowser } from "./_components/RentalServiceBrowser";
import { RentalPublicShowcase } from "./_components/RentalPublicShowcase";

export default function RentalLandingPage() {
  return (
    <div className="rental-public-catalog grid w-full items-start bg-[var(--public-canvas)] lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
      <RentalPublicShowcase />
      <RentalServiceBrowser />
    </div>
  );
}
