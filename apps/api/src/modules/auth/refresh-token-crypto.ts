import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_KEYLEN = 32;

export function hashRefreshToken(refreshTokenValue: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(refreshTokenValue, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export function verifyRefreshTokenConstantTime(
  refreshTokenValue: string,
  storedHash: string
): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }

  const salt = Buffer.from(parts[1], 'base64url');
  const expected = Buffer.from(parts[2], 'base64url');
  const actual = scryptSync(refreshTokenValue, salt, expected.length);
  return timingSafeEqual(actual, expected);
}
