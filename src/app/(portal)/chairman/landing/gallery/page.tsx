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
        activityDate: null,
        location: "Nasugbu, Batangas",
        borderColor: "#D8B04C",
        publicVisibility: true,
        galleryStatus: "Published",
        displayOrder: 0,
        images: [
          {
            imagePath: "/images/Other%20Landing%20Page/About.jpg",
            thumbnailPath: "/images/Other%20Landing%20Page/About.jpg",
            altText: "Cooperative activity photo",
            sortOrder: 0,
            isCover: true,
            publicVisibility: true,
          },
        ],
      }}
    />
  );
}
