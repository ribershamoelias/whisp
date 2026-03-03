import { UnauthorizedException } from '@nestjs/common';
import { JwtAccessService } from '../../common/auth/jwt-access.service';
import { AuthService } from './auth.service';
import { InMemoryRefreshTokenStore } from './refresh-token.store';
import { hashRefreshToken } from './refresh-token-crypto';

describe('AuthService', () => {
  let store: InMemoryRefreshTokenStore;
  let service: AuthService;

  beforeEach(() => {
    store = new InMemoryRefreshTokenStore();
    service = new AuthService(new JwtAccessService(), store);
  });

  it('stores hashed refresh token and never plaintext', async () => {
    const tokens = await service.login('wid-1', 'device-a');
    const snapshot = store.snapshotByWidDevice('wid-1', 'device-a');

    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].refresh_token_hash).toContain('scrypt$');
    expect(snapshot[0].refresh_token_hash).not.toBe(tokens.refresh_token_value);
  });

  it('rotates refresh token atomically with single active token', async () => {
    const first = await service.login('wid-1', 'device-a');
    const second = await service.refresh('wid-1', 'device-a', first.refresh_token_value);

    const snapshot = store.snapshotByWidDevice('wid-1', 'device-a');
    expect(snapshot.filter((record) => !record.revoked)).toHaveLength(1);
    expect(second.refresh_token_value).not.toBe(first.refresh_token_value);
  });

  it('reuses revoked token => family kill and no new token', async () => {
    const first = await service.login('wid-1', 'device-a');
    const second = await service.refresh('wid-1', 'device-a', first.refresh_token_value);

    await expect(service.refresh('wid-1', 'device-a', first.refresh_token_value)).rejects.toThrow(
      UnauthorizedException
    );

    await expect(service.refresh('wid-1', 'device-a', second.refresh_token_value)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('cross-device isolation keeps device-b valid after device-a compromise', async () => {
    const deviceAFirst = await service.login('wid-1', 'device-a');
    const deviceASecond = await service.refresh('wid-1', 'device-a', deviceAFirst.refresh_token_value);
    const deviceBFirst = await service.login('wid-1', 'device-b');

    await expect(
      service.refresh('wid-1', 'device-a', deviceAFirst.refresh_token_value)
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.refresh('wid-1', 'device-a', deviceASecond.refresh_token_value)
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.refresh('wid-1', 'device-b', deviceBFirst.refresh_token_value)
    ).resolves.toMatchObject({ access_token: expect.any(String) });
  });

  it('rolls back revoke when insert fails mid-rotation', async () => {
    const first = await service.login('wid-1', 'device-a');

    store.simulateNextInsertFailure();
    await expect(service.refresh('wid-1', 'device-a', first.refresh_token_value)).rejects.toThrow(
      'Simulated insert failure'
    );

    await expect(
      service.refresh('wid-1', 'device-a', first.refresh_token_value)
    ).resolves.toMatchObject({ access_token: expect.any(String) });
  });

  it('rejects unknown refresh token', async () => {
    await service.login('wid-1', 'device-a');
    await expect(service.refresh('wid-1', 'device-a', 'not-known')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects expired refresh token and revokes it', async () => {
    const expiredToken = 'expired-token-value';
    await store.withTransaction(async (tx) => {
      tx.insert({
        wid: 'wid-exp',
        device_id: 'device-exp',
        family_id: 'f-exp',
        jti: 'jti-exp-1',
        parent_jti: null,
        refresh_token_hash: hashRefreshToken(expiredToken),
        revoked: false,
        revoked_reason: null,
        expires_at: new Date(Date.now() - 60_000),
        created_at: new Date(Date.now() - 120_000)
      });
    });

    await expect(service.refresh('wid-exp', 'device-exp', expiredToken)).rejects.toThrow(
      UnauthorizedException
    );

    const snapshot = store.snapshotByWidDevice('wid-exp', 'device-exp');
    expect(snapshot[0].revoked).toBe(true);
    expect(snapshot[0].revoked_reason).toBe('expired');
  });

  it('rejects token when family already compromised before reuse', async () => {
    const validToken = 'family-precompromised-token';

    await store.withTransaction(async (tx) => {
      tx.insert({
        wid: 'wid-fam',
        device_id: 'device-fam',
        family_id: 'fam-1',
        jti: 'jti-fam-active',
        parent_jti: null,
        refresh_token_hash: hashRefreshToken(validToken),
        revoked: false,
        revoked_reason: null,
        expires_at: new Date(Date.now() + 60_000),
        created_at: new Date()
      });
      tx.insert({
        wid: 'wid-fam',
        device_id: 'device-fam',
        family_id: 'fam-1',
        jti: 'jti-fam-compromised',
        parent_jti: 'jti-fam-active',
        refresh_token_hash: hashRefreshToken('unused-token'),
        revoked: true,
        revoked_reason: 'family_compromised',
        expires_at: new Date(Date.now() + 60_000),
        created_at: new Date()
      });
    });

    await expect(service.refresh('wid-fam', 'device-fam', validToken)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('logout is no-op success and revokeDeviceSessions invalidates device tokens', async () => {
    const login = await service.login('wid-r', 'device-r');
    await expect(service.logout()).resolves.toBeUndefined();
    await expect(service.revokeDeviceSessions('wid-r', 'device-r')).resolves.toBeUndefined();
    await expect(service.refresh('wid-r', 'device-r', login.refresh_token_value)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('supports default device path for login and refresh', async () => {
    const login = await service.login('wid-default');
    await expect(service.refresh('wid-default', undefined, login.refresh_token_value)).resolves.toMatchObject({
      access_token: expect.any(String),
      refresh_token_value: expect.any(String)
    });
  });
});
