import { redirect } from "next/navigation";

export default async function VendorPageRedirect({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/hojo/vendor/${token}`);
}
