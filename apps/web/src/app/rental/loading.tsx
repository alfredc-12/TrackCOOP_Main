import { RentalLoadingState } from "./_components/RentalStates";

export default function Loading() {
  return <div className="p-4 sm:p-8"><RentalLoadingState label="Preparing the rental workspace" /></div>;
}
