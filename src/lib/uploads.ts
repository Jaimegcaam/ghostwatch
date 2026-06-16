import { readFile } from "fs/promises";
import { mkdir } from "fs/promises";
import { join } from "path";

import { get } from "@vercel/blob";

import { uploadPublicPath } from "@/lib/upload-url";

export { uploadPublicPath } from "@/lib/upload-url";

const UPLOADS_DIR = join(process.cwd(), "public", "uploads");

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const SAFE_FILENAME = /^[a-zA-Z0-9._-]+$/;

/** Blob pathname for Vercel Blob (private store). */
export function blobUploadPathname(filename: string): string {
  return `uploads/${filename}`;
}

export function usesBlobStorage(): boolean {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return Boolean(token && !token.includes("..."));
}

export function uploadsDirectory(): string {
  return UPLOADS_DIR;
}

export async function ensureUploadsDirectory(): Promise<void> {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

export function isSafeUploadFilename(filename: string): boolean {
  return SAFE_FILENAME.test(filename) && !filename.includes("..");
}

export function uploadContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

export async function readUploadFile(
  filename: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!isSafeUploadFilename(filename)) return null;

  try {
    const buffer = await readFile(join(UPLOADS_DIR, filename));
    return { buffer, contentType: uploadContentType(filename) };
  } catch {
    // Fall through to Vercel Blob when configured.
  }

  if (!usesBlobStorage()) return null;

  try {
    const result = await get(blobUploadPathname(filename), {
      access: "private",
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
    return {
      buffer,
      contentType: result.blob.contentType ?? uploadContentType(filename),
    };
  } catch {
    return null;
  }
}
