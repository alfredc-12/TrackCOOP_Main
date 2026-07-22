import { LandingAdminCollectionView } from "@/features/landing-admin/LandingAdminViews";

export default function ChairmanLandingGalleryPage() {
  return (
    <LandingAdminCollectionView
      collection="gallery"
      eyebrow="Public Website"
      title="Gallery"
      description="Published cooperative photos for events, projects, meetings, and field work."
      statusKey="galleryStatus"
      primaryKey="title"
      template={{
        title: "Cooperative activity",
        caption: "",
        category: "Community",
        imagePath: "/images/Other%20Landing%20Page/About.jpg",
        thumbnailPath: "",
        activityDate: null,
        location: "Nasugbu, Batangas",
        altText: "Cooperative activity photo",
        publicVisibility: true,
        galleryStatus: "Draft",
        displayOrder: 0,
      }}
    />
  );
}
