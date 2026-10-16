import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver } from "./types";

const root = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "./uploads");

function resolveKey(key: string) {
  const full = path.resolve(root, key);
  // Keys are generated server-side, but never allow escaping the upload root.
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export const localDriver: StorageDriver = {
  async put(key, data) {
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  },
  async get(key) {
    try {
      return await readFile(resolveKey(key));
    } catch {
      return null;
    }
  },
  async delete(key) {
    await rm(resolveKey(key), { force: true });
  },
};
