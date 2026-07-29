import { describe, it, expect } from 'vitest';
import { isRecoveryUrl } from '@/lib/recovery';

// Regression test for the reset-password flow: the recovery intent must be
// detected from the URL supabase sends the user back with. Before the fix,
// this check ran after supabase-js had already stripped the hash, so the
// set-password page never appeared.
describe('isRecoveryUrl', () => {
  it('detects a password recovery link', () => {
    expect(isRecoveryUrl('#access_token=abc&refresh_token=def&type=recovery')).toBe(true);
  });

  it('detects an invite link', () => {
    expect(isRecoveryUrl('#access_token=abc&type=invite')).toBe(true);
  });

  it('detects a signup confirmation link', () => {
    expect(isRecoveryUrl('#access_token=abc&type=signup')).toBe(true);
  });

  it('ignores a normal login (no hash)', () => {
    expect(isRecoveryUrl('')).toBe(false);
  });

  it('ignores a magiclink sign-in', () => {
    expect(isRecoveryUrl('#access_token=abc&type=magiclink')).toBe(false);
  });
});
