import { createProbeHandler } from "@/lib/probe";

export const runtime = "edge";
export const preferredRegion = "sfo1"; // San Francisco
export const POST = createProbeHandler("us-west-1");
