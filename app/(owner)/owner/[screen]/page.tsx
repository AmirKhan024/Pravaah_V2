import { OwnerScreen } from "@/components/owner/OwnerScreen";
export default async function OwnerPage({ params }: { params: Promise<{ screen: string }> }) { const { screen } = await params; return <OwnerScreen screen={screen} />; }
