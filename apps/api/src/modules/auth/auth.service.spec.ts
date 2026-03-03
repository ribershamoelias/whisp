import { UnauthorizedException } from '@nestjs/common';
import { JwtAccessService } from '../../common/auth/jwt-access.service';
import { AuthService } from './auth.service';
import { InMemoryRefreshTokenStore } from './refresh-token.store';

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
});
