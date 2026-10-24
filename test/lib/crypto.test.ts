import { describe, expect, it } from '@jest/globals';

import { decryptSecret, encryptSecret, generateKeyBase64 } from '@/lib/crypto';

describe('crypto', () => {
  it('round-trips a secret through encrypt/decrypt', async () => {
    const key = generateKeyBase64();
    const secret = '1//0gRefreshTokenValueThatLooksLikeGoogles';
    const sealed = await encryptSecret(secret, key);
    expect(sealed).not.toContain(secret);
    expect(await decryptSecret(sealed, key)).toBe(secret);
  });

  it('produces a different blob each time (random IV)', async () => {
    const key = generateKeyBase64();
    const a = await encryptSecret('same', key);
    const b = await encryptSecret('same', key);
    expect(a).not.toBe(b);
    expect(await decryptSecret(a, key)).toBe('same');
    expect(await decryptSecret(b, key)).toBe('same');
  });

  it('fails to decrypt with the wrong key', async () => {
    const sealed = await encryptSecret('top secret', generateKeyBase64());
    await expect(decryptSecret(sealed, generateKeyBase64())).rejects.toThrow();
  });

  it('rejects a key that is not 256-bit', async () => {
    await expect(encryptSecret('x', btoa('tooshort'))).rejects.toThrow(
      /256-bit/,
    );
  });

  it('handles unicode plaintext', async () => {
    const key = generateKeyBase64();
    const secret = 'paneer ki sabji — 🫕 naïve café';
    expect(await decryptSecret(await encryptSecret(secret, key), key)).toBe(
      secret,
    );
  });
});
