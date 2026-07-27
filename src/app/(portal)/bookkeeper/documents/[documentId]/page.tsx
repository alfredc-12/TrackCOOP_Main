import { DocumentDetailPage } from "@/features/records/components/DocumentDetailPage";

export default async function BookkeeperDocumentDetailPage(props: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await props.params;
  return <DocumentDetailPage role="bookkeeper" documentId={documentId} />;
}
