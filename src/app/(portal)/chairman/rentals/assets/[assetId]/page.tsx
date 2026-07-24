import { ChairmanRentalAssetDetails } from "../../_components/ChairmanRentalAssetDetails";

export default async function ChairmanRentalAssetDetailsPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  return <ChairmanRentalAssetDetails serviceId={assetId} />;
}
