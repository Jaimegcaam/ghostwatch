import { createProbeHandler } from "@/lib/probe";

export const runtime = "edge";
export const preferredRegion = "iad1"; // Washington DC
export const POST = createProbeHandler("us-east-1");
