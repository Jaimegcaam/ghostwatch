import { put } from "@vercel/blob";
import { writeFile } from "fs/promises";
import { join } from "path";

import { uploadPublicPath } from "@/lib/upload-url";
import {
  blobUploadPathname,
  ensureUploadsDirectory,
  uploadsDirectory,
  usesBlobStorage,
} from "@/lib/uploads";

export type ImageUploadExt = "png" | "jpg" | "webp";

const EXT_CONTENT_TYPE: Record<ImageUploadExt, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

function sniffImageExt(buffer: Buffer): ImageUploadExt | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "jpg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function extFromFilename(name: string): ImageUploadExt | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "png") return "png";
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "webp") return "webp";
  return null;
}

/** Validate PNG/JPG/WebP uploads (MIME, extension, or magic bytes). */
export function validateImageUpload(
  file: File,
  buffer: Buffer,
): { ext: ImageUploadExt; contentType: string } | { error: string } {
  const allowedTypes = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/webp",
  ]);

  const sniffed = sniffImageExt(buffer);
  const fromName = extFromFilename(file.name);
  const fromMime = allowedTypes.has(file.type)
    ? file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg"
    : null;

  const ext = sniffed ?? fromMime ?? fromName;
  if (!ext) {
    return { error: "Only PNG, JPG and WebP files are allowed" };
  }

  return { ext, contentType: EXT_CONTENT_TYPE[ext] };
}

function randomFilename(ext: ImageUploadExt): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

function getBlobReadWriteToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token || token.includes("...")) return null;
  return token;
}

function blobAccessHelp(): string {
  return (
    "Vercel Blob rejected the upload token. In Vercel → Storage → ghostwatch-blob → Settings, " +
    "reset the read-write token, confirm BLOB_READ_WRITE_TOKEN is set for Production, then redeploy."
  );
}

/**
 * Persist an uploaded image. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set
 * (required on Vercel). Otherwise writes to public/uploads (Docker / self-hosted).
 */
export async function persistImageUpload(
  buffer: Buffer,
  ext: ImageUploadExt,
): Promise<string> {
  const filename = randomFilename(ext);
  const contentType = EXT_CONTENT_TYPE[ext];
  const blobToken = getBlobReadWriteToken();

  if (blobToken) {
    try {
      const pathname = blobUploadPathname(filename);
      await put(pathname, buffer, {
        access: "private",
        contentType,
        addRandomSuffix: false,
      });
      // Serve via /api/uploads (proxies private blobs with the server token).
      return uploadPublicPath(filename);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      if (
        message.includes("Access denied") ||
        message.includes("valid token")
      ) {
        throw new Error(blobAccessHelp());
      }
      if (message.includes("public access on a private store")) {
        throw new Error(
          "Blob store access mismatch. Redeploy the latest app version — private stores are supported via /api/uploads.",
        );
      }
      throw error;
    }
  }

  if (process.env.VERCEL === "1") {
    throw new Error(
      "Image uploads on Vercel require BLOB_READ_WRITE_TOKEN. Create a Blob store in Vercel → Storage, then add the token to your project environment variables.",
    );
  }

  try {
    await ensureUploadsDirectory();
    await writeFile(join(uploadsDirectory(), filename), buffer);
  } catch {
    throw new Error(
      "Could not save the image. Ensure public/uploads is writable or configure BLOB_READ_WRITE_TOKEN.",
    );
  }

  return uploadPublicPath(filename);
}
