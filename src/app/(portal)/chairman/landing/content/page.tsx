import { LandingAdminCollectionView } from "@/features/landing-admin/LandingAdminViews";

export default function ChairmanLandingContentPage() {
  return (
    <LandingAdminCollectionView
      collection="content-blocks"
      eyebrow="Public Website"
      title="Page Content"
      description="Published homepage and cooperative profile content managed by the Chairman."
      statusKey="contentStatus"
      primaryKey="sectionKey"
      template={{
        pageSlug: "home",
        sectionKey: "hero",
        contentType: "Heading",
        title: "Nasugbu Farmers and Fisherfolks Agriculture Cooperative",
        body: "",
        valueText: "",
        linkLabel: "",
        linkUrl: "",
        mediaPath: "",
        displayOrder: 0,
        contentStatus: "Draft",
      }}
    />
  );
}
