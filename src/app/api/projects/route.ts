import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";

const types = new Set(["GAMEPLAY","TERRAIN","VEHICLE","FRAMEWORK","AUDIO","TRAINING","OTHER"]);
export async function GET() {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const projects = await db.project.findMany({ include: { owner: { select: { id:true,name:true,role:true } }, members: true }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ projects });
}
export async function POST(request: Request) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({})); const name=text(body.name,100); const description=text(body.description,1200); const type=String(body.type||"");
  if(name.length<3||description.length<12||!types.has(type)) return NextResponse.json({error:"Complete the project name, type, and mission brief."},{status:400});
  const project=await db.project.create({data:{code:`FO-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,name,description,type:type as never,repository:text(body.repository,250)||null,ownerId:user.id,members:{create:{userId:user.id,title:"Project Lead"}}},include:{owner:{select:{id:true,name:true,role:true}},members:true}});
  await db.auditLog.create({data:{actorId:user.id,action:"PROJECT_REQUESTED",entity:"Project",entityId:project.id,detail:{name}}});
  return NextResponse.json({project},{status:201});
}
