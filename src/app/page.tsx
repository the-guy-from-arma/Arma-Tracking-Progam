import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Dashboard } from "@/components/Dashboard";
export const dynamic="force-dynamic";
export default async function Page(){const user=await currentUser();if(!user)redirect("/login");const[projects,users]=await Promise.all([db.project.findMany({include:{owner:{select:{id:true,name:true,role:true}},members:true},orderBy:{updatedAt:"desc"}}),db.user.findMany({select:{id:true,email:true,name:true,role:true,specialty:true,createdAt:true},orderBy:{createdAt:"asc"}})]);return <Dashboard initialUser={user} initialProjects={projects} initialUsers={users}/>}
