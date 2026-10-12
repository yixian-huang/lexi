import { useCallback, useEffect, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import {
  checkForUpdate,
  downloadAndRelaunch,
  isTauriRuntime,
  type UpdateStatus,
} from "../updater/check";

type Props = {
  /** When true, check once after mount (desktop only). */
  checkOnLaunch?: boolean;
};

export default function UpdaterBanner({ checkOnLaunch = true }: Props) {
  const [status, setStatus] = useState<UpdateStatus>({ kind: "idle" });
  const [pending, setPending] = useState<Update | null>(null);

  const runCheck = useCallback(async (silent: boolean) => {
    if (!isTauriRuntime()) {
      if (!silent) setStatus({ kind: "unsupported" });
      return;
    }
    setStatus({ kind: "checking" });
    try {
      const update = await checkForUpdate();
      if (!update) {
        setPending(null);
        setStatus(silent ? { kind: "idle" } : { kind: "upToDate" });
        return;
      }
      setPending(update);
      setStatus({
        kind: "available",
        version: update.version,
        notes: update.body ?? null,
        update,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Update check failed";
      // Silent launch: stay quiet (private repo / no latest.json yet)
      if (silent) {
        setStatus({ kind: "idle" });
        return;
      }
      setStatus({ kind: "error", message });
    }
  }, []);

  useEffect(() => {
    if (!checkOnLaunch) return;
    const t = window.setTimeout(() => {
      void runCheck(true);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [checkOnLaunch, runCheck]);

  async function onInstall() {
    if (!pending) return;
    const version = pending.version;
    setStatus({ kind: "downloading", version, progress: 0 });
    try {
      await downloadAndRelaunch(pending, (ratio) => {
        setStatus({
          kind: "downloading",
          version,
          progress: ratio,
        });
      });
      setStatus({ kind: "installing", version });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Update install failed",
      });
    }
  }

  if (status.kind === "idle") {
    return (
      <div className="updater-bar muted">
        <button type="button" className="linkish" onClick={() => void runCheck(false)}>
          Check for updates
        </button>
      </div>
    );
  }

  if (status.kind === "checking") {
    return (
      <div className="updater-bar" role="status">
        <span className="spinner" aria-hidden /> Checking for updates…
      </div>
    );
  }

  if (status.kind === "upToDate") {
    return (
      <div className="updater-bar okish">
        You’re up to date.
        <button type="button" className="linkish" onClick={() => void runCheck(false)}>
          Check again
        </button>
      </div>
    );
  }

  if (status.kind === "available") {
    return (
      <div className="updater-bar available" role="status">
        <div>
          <strong>Update {status.version} available</strong>
          {status.notes && <p className="updater-notes">{status.notes}</p>}
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={() => void onInstall()}>
          Download &amp; restart
        </button>
      </div>
    );
  }

  if (status.kind === "downloading") {
    const pct =
      status.progress == null ? null : Math.round(status.progress * 100);
    return (
      <div className="updater-bar" role="status">
        Downloading {status.version}
        {pct != null ? `… ${pct}%` : "…"}
      </div>
    );
  }

  if (status.kind === "installing") {
    return (
      <div className="updater-bar" role="status">
        Installing {status.version}… restarting
      </div>
    );
  }

  if (status.kind === "unsupported") {
    return (
      <div className="updater-bar muted">
        Auto-update runs in the desktop app (not in the browser preview).
      </div>
    );
  }

  // error
  return (
    <div className="updater-bar error" role="alert">
      <div>
        <strong>Update check failed</strong>
        <p className="updater-notes">{status.message}</p>
        <p className="updater-notes">
          If the GitHub repo is private, release assets are not publicly
          fetchable — make releases public or host <code>latest.json</code> on a
          public URL.
        </p>
      </div>
      <button type="button" className="btn-secondary btn-sm" onClick={() => void runCheck(false)}>
        Retry
      </button>
    </div>
  );
}
