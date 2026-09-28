import { notFound, redirect } from "next/navigation";

export default async function LegacyActivationRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  if (!token) {
    notFound();
  }

  redirect(`/membership/activate/${encodeURIComponent(token)}`);
}
