import { LoadingSpinner } from "@/components/ui/LoadingStates";

export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f8f3] text-[#17211c]" aria-busy="true">
      <LoadingSpinner label="Loading TrackCOOP..." className="font-semibold" />
    </div>
  );
}
