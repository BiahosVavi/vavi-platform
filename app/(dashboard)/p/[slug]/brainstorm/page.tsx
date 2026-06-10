import { redirect } from "next/navigation";

export default async function BrainstormIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/p/${slug}/brainstorm/notes`);
}
