import "server-only";
import { randomUUID } from "node:crypto";
import { localDriver } from "./local";
import type { StorageDriver } from "./types";

// Swap point for S3 / Cloudflare R2: add a driver implementing StorageDriver and select it here.
function pickDriver(): StorageDriver {
  switch (process.env.STORAGE_DRIVER ?? "local") {
    case "local":
      return localDriver;
    default:
      throw new Error(`Unsupported STORAGE_DRIVER "${process.env.STORAGE_DRIVER}"`);
  }
}

export const storage = pickDriver();

export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024;

/** Validates and stores an uploaded file; returns its storage metadata. */
export async function saveUpload(file: File, folder: string) {
  const ext = ALLOWED_UPLOAD_TYPES[file.type];
  if (!ext) throw new UploadError("Only PDF, JPG, PNG or WEBP files are allowed.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError(`Files must be ${process.env.MAX_UPLOAD_MB || 10} MB or smaller.`);
  if (file.size === 0) throw new UploadError("The file is empty.");

  const now = new Date();
  const key = `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`;
  await storage.put(key, Buffer.from(await file.arrayBuffer()), file.type);
  return { fileKey: key, fileName: file.name.slice(0, 200), mimeType: file.type, sizeBytes: file.size };
}

export class UploadError extends Error {}
