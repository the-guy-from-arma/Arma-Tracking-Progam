import { PolicyCenter } from "@/components/PolicyCenter";
export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <PolicyCenter initialSlug={slug} />; }
