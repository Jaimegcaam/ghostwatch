import { createProbeHandler } from "@/lib/probe";

export const runtime = "edge";
export const preferredRegion = "sin1"; // Singapore
export const POST = createProbeHandler("ap-southeast-1");
