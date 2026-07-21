import { LandingAdminCollectionView } from "@/features/landing-admin/LandingAdminViews";

export default function ChairmanLandingPartnersPage() {
  return (
    <LandingAdminCollectionView
      collection="partners"
      eyebrow="Public Website"
      title="Partners and Certifications"
      description="Public partner logos, certifications, compliance files, and recognition records."
      statusKey="status"
      primaryKey="name"
      template={{
        recordType: "Certification",
        name: "Certificate of Registration",
        description: "",
        logoPath: "",
        externalUrl: "",
        issuedDate: null,
        expirationDate: null,
        publicVisibility: true,
        status: "Draft",
        displayOrder: 0,
      }}
    />
  );
}
