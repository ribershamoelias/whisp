import { hashRefreshToken, verifyRefreshTokenConstantTime } from './refresh-token-crypto';

describe('refresh-token-crypto', () => {
  it('verifies correct token', () => {
    const token = 'token-abc';
    const hash = hashRefreshToken(token);
    expect(verifyRefreshTokenConstantTime(token, hash)).toBe(true);
  });

  it('rejects wrong token', () => {
    const hash = hashRefreshToken('token-abc');
    expect(verifyRefreshTokenConstantTime('token-def', hash)).toBe(false);
  });

  it('rejects malformed hash format', () => {
    expect(verifyRefreshTokenConstantTime('token-abc', 'not-a-valid-hash')).toBe(false);
  });
});
