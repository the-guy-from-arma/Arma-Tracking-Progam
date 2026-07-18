import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { policyCompliance } from "@/lib/policies";
export async function GET() { const user = await currentUser(); if(!user)return NextResponse.json({ error: "Authentication required" }, { status: 401 }); const compliance=user.isStudent?await policyCompliance(user.id):{compliant:true,missing:[]}; return NextResponse.json({ user, policyCompliant:compliance.compliant, missingPolicyVersions:compliance.missing.map(item=>({id:item.currentVersion.id,slug:item.slug,title:item.title,version:item.currentVersion.version})),policyGateUrl:compliance.compliant?null:"/policies/accept"}); }
