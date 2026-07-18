import { PolicyInquiryStatus } from "@/components/PolicyInquiryStatus";
export default async function InquiryStatusPage({params}:{params:Promise<{trackingNumber:string}>}){const{trackingNumber}=await params;return <PolicyInquiryStatus trackingNumber={trackingNumber}/>}
