import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { persistImageUpload, validateImageUpload } from "@/lib/upload-storage";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const maxSize = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: "File must be under 2MB" },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const validated = validateImageUpload(file, buffer);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const url = await persistImageUpload(buffer, validated.ext);
    return NextResponse.json({ url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed";
    console.error("Upload failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
