import { currentUser } from "@/lib/auth";
import { PortalGateway } from "@/components/PortalGateway";

export const dynamic = "force-dynamic";
export default async function GatewayPage() { const user = await currentUser(); return <PortalGateway user={user ? { name: user.name, isStudent: user.isStudent, role: user.role } : null}/>; }
