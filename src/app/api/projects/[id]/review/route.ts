import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const user=await currentUser();if(!user||!isAdmin(user.role))return NextResponse.json({error:"Admin authority required"},{status:403});const{id}=await params;const body=await request.json().catch(()=>({}));const status=body.approved?"ACTIVE":"REJECTED";const project=await db.project.update({where:{id},data:{status,reviewedById:user.id,reviewedAt:new Date(),reviewNote:text(body.note,500)||null},include:{owner:{select:{id:true,name:true,role:true}},members:true}}).catch(()=>null);if(!project)return NextResponse.json({error:"Project not found"},{status:404});await db.auditLog.create({data:{actorId:user.id,action:`PROJECT_${status}`,entity:"Project",entityId:id}});return NextResponse.json({project});}
