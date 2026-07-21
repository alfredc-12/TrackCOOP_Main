import { LandingAdminCollectionView } from "@/features/landing-admin/LandingAdminViews";

export default function ChairmanLandingServicesPage() {
  return (
    <LandingAdminCollectionView
      collection="services"
      eyebrow="Public Website"
      title="Services"
      description="Public service entries for membership help, farm programs, rentals, and store information."
      statusKey="serviceStatus"
      primaryKey="title"
      template={{
        serviceCode: "membership-assistance",
        serviceType: "Membership",
        title: "Membership Assistance",
        shortDescription: "Help for member records and cooperative support requests.",
        fullDescription: "",
        requirementsText: "",
        imagePath: "",
        ctaLabel: "Start inquiry",
        ctaUrl: "#contact",
        publicVisibility: true,
        serviceStatus: "Draft",
        displayOrder: 0,
      }}
    />
  );
}
