import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; version: string; notes: string | null; update: Update }
  | { kind: "downloading"; version: string; progress: number | null }
  | { kind: "installing"; version: string }
  | { kind: "upToDate" }
  | { kind: "error"; message: string }
  | { kind: "unsupported" };

/** True when running inside a Tauri webview (not plain Vite). */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function checkForUpdate(): Promise<Update | null> {
  if (!isTauriRuntime()) return null;
  return check();
}

export async function downloadAndRelaunch(
  update: Update,
  onProgress?: (ratio: number | null) => void,
): Promise<void> {
  let downloaded = 0;
  let contentLength: number | null = null;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        contentLength = event.data.contentLength ?? null;
        onProgress?.(contentLength ? 0 : null);
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        if (contentLength && contentLength > 0) {
          onProgress?.(Math.min(1, downloaded / contentLength));
        } else {
          onProgress?.(null);
        }
        break;
      case "Finished":
        onProgress?.(1);
        break;
    }
  });
  await relaunch();
}
