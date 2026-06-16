import { createProbeHandler } from "@/lib/probe";

export const runtime = "edge";
export const preferredRegion = "gru1"; // São Paulo
export const POST = createProbeHandler("sa-east-1");
