import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
const roles=new Set(["TRAINEE","DEVELOPER","VETERAN","ADMIN"]);
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const owner=await currentUser();if(!owner||owner.role!=="OWNER")return NextResponse.json({error:"Owner authority required"},{status:403});const{id}=await params;const{role}=await request.json().catch(()=>({}));if(!roles.has(role))return NextResponse.json({error:"Invalid assignable role"},{status:400});const user=await db.user.update({where:{id},data:{role},select:{id:true,email:true,name:true,role:true,specialty:true,createdAt:true}}).catch(()=>null);if(!user)return NextResponse.json({error:"User not found"},{status:404});await db.auditLog.create({data:{actorId:owner.id,action:"ROLE_CHANGED",entity:"User",entityId:id,detail:{role}}});return NextResponse.json({user});}
