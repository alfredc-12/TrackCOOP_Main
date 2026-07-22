import { LandingAdminCollectionView } from "@/features/landing-admin/LandingAdminViews";

export default function ChairmanLandingProgramsPage() {
  return (
    <LandingAdminCollectionView
      collection="programs"
      eyebrow="Public Website"
      title="Programs and Projects"
      description="Public cooperative programs, agriculture projects, and community initiatives."
      statusKey="status"
      primaryKey="title"
      template={{
        title: "Rice Production Support",
        category: "Agriculture",
        summary: "Seed, field monitoring, and harvest coordination for member farms.",
        description: "",
        startDate: null,
        endDate: null,
        location: "Nasugbu, Batangas",
        imagePath: "",
        publicVisibility: true,
        status: "Draft",
        displayOrder: 0,
      }}
    />
  );
}
