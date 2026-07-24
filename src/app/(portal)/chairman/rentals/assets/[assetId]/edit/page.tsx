import { ChairmanRentalAssetEditor } from "../../../_components/ChairmanRentalAssetEditor";

export default async function EditChairmanRentalAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  return <ChairmanRentalAssetEditor serviceId={assetId} />;
}
