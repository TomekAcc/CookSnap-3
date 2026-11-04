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
const SCANS_DIR_NAME = "cooksnap-scans";

export function persistPhotoToDevice(sourceUri) {
  try {
    const scansDir = new Directory(Paths.document, SCANS_DIR_NAME);
    scansDir.create({ intermediates: true, idempotent: true });
    const sourceFile = new File(sourceUri);
    const ext = sourceFile.extension || ".jpg";
    const destFile = new File(scansDir, `scan-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    sourceFile.copy(destFile);
    return destFile.uri;
  } catch (err) {
    log.warn("[CookSnap] Could not persist scan photo to device:", err?.message);
    return sourceUri;
  }
}

/** Last path segment of a file uri ("file:///x/cooksnap-scans/scan-1.jpg" -> "scan-1.jpg"). */
function baseName(uri) {
  return String(uri || "").split("?")[0].split("/").pop() || "";
}

/**
 * Deletes every stored scan photo that nothing refers to any more. A photo stays on the phone only while it is
 * the current scan's photo or one of the saved history entries: removing a scan from the history, the history's
 * ten-entry limit, and photos left behind by a replaced scan all end up here, so a picture of someone's kitchen
 * never lingers after they have removed it from the app. Never throws; returns how many files were removed.
 */
export function pruneUnusedPhotos(keepUris = []) {
  try {
    const dir = new Directory(Paths.document, SCANS_DIR_NAME);
    if (!dir.exists) return 0;
    const keep = new Set((keepUris || []).filter(Boolean).map(baseName));
    let removed = 0;
    for (const entry of dir.list()) {
      const name = baseName(entry.uri);
      if (!name.startsWith("scan-") || keep.has(name)) continue;
      try {
        entry.delete();
        removed += 1;
      } catch (err) {
        log.warn("[CookSnap] Could not delete an unused scan photo:", err?.message);
      }
    }
    return removed;
  } catch (err) {
    log.warn("[CookSnap] Could not clean up scan photos:", err?.message);
    return 0;
  }
}

/** Deletes every stored scan photo ("Delete all my data"). */
export function deleteAllPhotos() {
  return pruneUnusedPhotos([]);
}
