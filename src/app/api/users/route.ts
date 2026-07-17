import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET(){const user=await currentUser();if(!user)return NextResponse.json({error:"Authentication required"},{status:401});const users=await db.user.findMany({select:{id:true,email:true,name:true,role:true,specialty:true,createdAt:true},orderBy:{createdAt:"asc"}});return NextResponse.json({users});}
