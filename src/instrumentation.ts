/**
 * Next.js server startup hook (https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation).
 * Ensures the iCloud storage tree exists before the app starts serving.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.VERCEL) return; // no iCloud Drive on serverless; local-dev only

  const { ensureIcloudDirs } = await import("./lib/storage/paths");
  const { failed } = ensureIcloudDirs();
  if (failed.length > 0) {
    console.warn(
      `[storage] iCloud Drive not available; ${failed.length} storage director${
        failed.length === 1 ? "y" : "ies"
      } could not be created. Set LEVELUP_STORAGE_DIR to override.`
    );
  }
}
