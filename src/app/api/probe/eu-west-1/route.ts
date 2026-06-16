import { createProbeHandler } from "@/lib/probe";

export const runtime = "edge";
export const preferredRegion = "cdg1"; // Paris
export const POST = createProbeHandler("eu-west-1");
