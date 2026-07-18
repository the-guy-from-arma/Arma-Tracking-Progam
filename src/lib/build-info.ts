export const DOCUMENT_RENDERER_VERSION = "academic-records-2026.07.18.2";

export function deploymentFingerprint() {
  return {
    commit:
      process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) ||
      process.env.GIT_COMMIT_SHA?.slice(0, 12) ||
      "local",
    documentRenderer: DOCUMENT_RENDERER_VERSION,
  };
}
