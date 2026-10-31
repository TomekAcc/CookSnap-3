import { Directory, File, Paths } from "expo-file-system";
import { log } from "./log";

/**
 * Copies a captured/picked fridge photo into a permanent, app-owned
 * directory (Paths.document) instead of leaving it at its original
 * ephemeral location — camera captures and gallery picks both land in
 * OS-managed cache/temp paths that are NOT guaranteed to survive an app
 * restart or a cache purge. Without this, `fridgePhoto` and `scanHistory`
 * thumbnails would silently break (broken image) even if the URI string
 * itself were persisted correctly, since the underlying file could already
 * be gone. Falls back to the original URI on any failure — a scan should
 * never be blocked by a storage-housekeeping step failing.
 */
export function persistPhotoToDevice(sourceUri) {
  try {
    const scansDir = new Directory(Paths.document, "cookai-scans");
    scansDir.create({ intermediates: true, idempotent: true });
    const sourceFile = new File(sourceUri);
    const ext = sourceFile.extension || ".jpg";
    const destFile = new File(scansDir, `scan-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    sourceFile.copy(destFile);
    return destFile.uri;
  } catch (err) {
    log.warn("[Cook AI] Could not persist scan photo to device:", err?.message);
    return sourceUri;
  }
}
