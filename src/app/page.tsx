import { currentUser } from "@/lib/auth";
import { PortalGateway } from "@/components/PortalGateway";
import { campusStatus } from "@/lib/campus-operations";

export const dynamic = "force-dynamic";
export default async function GatewayPage() {
  const [user, operations] = await Promise.all([currentUser(), campusStatus()]);
  return (
    <PortalGateway
      user={user ? { name: user.name, isStudent: user.isStudent, role: user.role } : null}
      operations={{
        admissionsMode: operations.admissionsMode,
        enrollmentMode: operations.enrollmentMode,
        learningMode: operations.learningMode,
        publicTitle: operations.publicTitle,
        publicMessage: operations.publicMessage,
        reopensAt: operations.reopensAt?.toISOString() ?? null,
      }}
    />
  );
}
