import { UnauthorizedException } from '@nestjs/common';
import { JwtAccessService } from './jwt-access.service';

describe('JwtAccessService', () => {
  const originalSecret = process.env.ACCESS_TOKEN_SECRET;
  const originalTtl = process.env.ACCESS_TOKEN_TTL_SECONDS;

  afterEach(() => {
    process.env.ACCESS_TOKEN_SECRET = originalSecret;
    process.env.ACCESS_TOKEN_TTL_SECONDS = originalTtl;
  });

  it('issues and verifies access token', () => {
    process.env.ACCESS_TOKEN_SECRET = 'test-secret';
    process.env.ACCESS_TOKEN_TTL_SECONDS = '300';

    const jwtService = new JwtAccessService();
    const token = jwtService.issueAccessToken('wid-1');
    const payload = jwtService.verifyAccessToken(token);

    expect(payload.sub).toBe('wid-1');
    expect(payload.typ).toBe('access');
  });

  it('rejects expired token with deterministic 401', async () => {
    process.env.ACCESS_TOKEN_SECRET = 'test-secret';
    process.env.ACCESS_TOKEN_TTL_SECONDS = '1';

    const jwtService = new JwtAccessService();
    const token = jwtService.issueAccessToken('wid-expire');

    await new Promise((resolve) => setTimeout(resolve, 1200));

    expect(() => jwtService.verifyAccessToken(token)).toThrow(UnauthorizedException);
  });

  it('rejects invalid signature token', () => {
    process.env.ACCESS_TOKEN_SECRET = 'secret-a';
    const issuer = new JwtAccessService();
    const token = issuer.issueAccessToken('wid-1');

    process.env.ACCESS_TOKEN_SECRET = 'secret-b';
    const verifier = new JwtAccessService();

    expect(() => verifier.verifyAccessToken(token)).toThrow(UnauthorizedException);
  });
});
