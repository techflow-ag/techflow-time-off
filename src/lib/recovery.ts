// Detects a Supabase recovery/invite/signup link from the URL fragment.
// Kept dependency-free so it can be evaluated at module load, before
// supabase-js strips the token hash from the URL.
export function isRecoveryUrl(urlFragment: string) {
  return /type=(recovery|invite|signup)/.test(urlFragment);
}
