import { DocumentDetailPage } from "@/features/records/components/DocumentDetailPage";

export default async function ChairmanDocumentDetailPage(props: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await props.params;
  return <DocumentDetailPage role="chairman" documentId={documentId} />;
}
