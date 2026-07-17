import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";

const updateTypes = new Set(["PROGRESS", "MILESTONE", "DECISION", "BLOCKER"]);
const objectiveStatuses = new Set(["PLANNED", "IN_PROGRESS", "BLOCKED", "COMPLETED"]);
const priorities = new Set(["LOW", "NORMAL", "HIGH", "CRITICAL"]);
const httpUrl = (value: unknown) => { const result = text(value, 500); return /^https?:\/\//i.test(result) ? result : ""; };

async function access(projectId: string, userId: string, role: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { members: { where: { userId } } } });
  if (!project) return null;
  const member = project.ownerId === userId || project.members.length > 0 || isAdmin(role);
  return { project, member, manage: project.ownerId === userId || isAdmin(role) };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params; const permission = await access(id, user.id, user.role);
  if (!permission || (permission.project.status !== "ACTIVE" && !permission.member)) return NextResponse.json({ error: "Project workspace not found." }, { status: 404 });
  const project = await db.project.findUnique({ where: { id }, include: {
    owner: { select: { id: true, name: true, role: true } },
    members: { include: { user: { select: { id: true, name: true, role: true, specialty: true } } }, orderBy: { joinedAt: "asc" } },
    updates: { include: { author: { select: { id: true, name: true, role: true } }, comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } },
    notes: { include: { author: { select: { id: true, name: true } } }, orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }] },
    objectives: { include: { assignee: { select: { id: true, name: true } } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    references: { orderBy: { createdAt: "desc" } },
  } });
  return NextResponse.json({ project, canWrite: permission.member, canManage: permission.manage });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params; const permission = await access(id, user.id, user.role);
  if (!permission?.member) return NextResponse.json({ error: "Project membership is required to contribute." }, { status: 403 });
  const body = await request.json().catch(() => ({})); const action = String(body.action || "");
  let entity = "Project"; let entityId = id; let result: unknown;

  if (action === "create_update") {
    const title = text(body.title, 120); const content = text(body.body, 5000); const type = String(body.type || "PROGRESS");
    if (title.length < 3 || content.length < 10 || !updateTypes.has(type)) return NextResponse.json({ error: "Complete the update title, type, and details." }, { status: 400 });
    result = await db.projectUpdate.create({ data: { projectId: id, authorId: user.id, title, body: content, type: type as never }, include: { author: { select: { id: true, name: true, role: true } }, comments: true } }); entity = "ProjectUpdate"; entityId = (result as { id: string }).id;
  } else if (action === "create_note") {
    const title = text(body.title, 120); const content = text(body.body, 8000); const tags = text(body.tags, 300).split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
    if (title.length < 3 || content.length < 10) return NextResponse.json({ error: "Complete the note title and knowledge entry." }, { status: 400 });
    result = await db.projectNote.create({ data: { projectId: id, authorId: user.id, title, body: content, tags, pinned: Boolean(body.pinned && permission.manage) }, include: { author: { select: { id: true, name: true } } } }); entity = "ProjectNote"; entityId = (result as { id: string }).id;
  } else if (action === "create_objective") {
    const title = text(body.title, 140); const details = text(body.details, 2400); const priority = String(body.priority || "NORMAL"); const assigneeId = text(body.assigneeId, 100);
    if (title.length < 3 || details.length < 5 || !priorities.has(priority)) return NextResponse.json({ error: "Complete the objective and priority." }, { status: 400 });
    result = await db.projectObjective.create({ data: { projectId: id, title, details, priority: priority as never, assigneeId: assigneeId || null, dueDate: body.dueDate ? new Date(String(body.dueDate)) : null, sortOrder: await db.projectObjective.count({ where: { projectId: id } }) } }); entity = "ProjectObjective"; entityId = (result as { id: string }).id;
  } else if (action === "create_reference") {
    const label = text(body.label, 120); const url = httpUrl(body.url); const type = text(body.type, 40).toUpperCase() || "REFERENCE";
    if (label.length < 2 || !url) return NextResponse.json({ error: "Add a label and complete http or https reference URL." }, { status: 400 });
    result = await db.projectReference.create({ data: { projectId: id, label, url, type } }); entity = "ProjectReference"; entityId = (result as { id: string }).id;
  } else if (action === "comment_update") {
    const updateId = text(body.updateId, 100); const content = text(body.body, 2000);
    if (content.length < 2 || !await db.projectUpdate.findFirst({ where: { id: updateId, projectId: id } })) return NextResponse.json({ error: "Update or comment not found." }, { status: 400 });
    result = await db.projectComment.create({ data: { updateId, authorId: user.id, body: content }, include: { author: { select: { id: true, name: true } } } }); entity = "ProjectComment"; entityId = (result as { id: string }).id;
  } else if (action === "add_member") {
    if (!permission.manage) return NextResponse.json({ error: "Project management authority required." }, { status: 403 });
    const userId = text(body.userId, 100); const member = await db.user.findUnique({ where: { id: userId } });
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    result = await db.membership.upsert({ where: { projectId_userId: { projectId: id, userId } }, update: { title: text(body.title, 80) || "Contributor" }, create: { projectId: id, userId, title: text(body.title, 80) || "Contributor" } }); entity = "Membership"; entityId = (result as { id: string }).id;
  } else return NextResponse.json({ error: "Unknown workspace action." }, { status: 400 });

  await db.auditLog.create({ data: { actorId: user.id, action: `PROJECT_${action.toUpperCase()}`, entity, entityId, detail: { projectId: id } } });
  return NextResponse.json({ result }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params; const permission = await access(id, user.id, user.role);
  if (!permission?.member) return NextResponse.json({ error: "Project membership is required." }, { status: 403 });
  const body = await request.json().catch(() => ({})); const objectiveId = text(body.objectiveId, 100); const status = String(body.status || "");
  if (!objectiveStatuses.has(status)) return NextResponse.json({ error: "Choose a valid objective status." }, { status: 400 });
  const objective = await db.projectObjective.findFirst({ where: { id: objectiveId, projectId: id } }); if (!objective) return NextResponse.json({ error: "Objective not found." }, { status: 404 });
  const updated = await db.$transaction(async (tx) => {
    const saved = await tx.projectObjective.update({ where: { id: objective.id }, data: { status: status as never } });
    const [complete, total] = await Promise.all([tx.projectObjective.count({ where: { projectId: id, status: "COMPLETED" } }), tx.projectObjective.count({ where: { projectId: id } })]);
    await tx.project.update({ where: { id }, data: { progress: total ? Math.round((complete / total) * 100) : 0 } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "PROJECT_OBJECTIVE_STATUS", entity: "ProjectObjective", entityId: objective.id, detail: { projectId: id, status } } }); return saved;
  });
  return NextResponse.json({ objective: updated });
}
