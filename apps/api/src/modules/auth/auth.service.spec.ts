import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('returns token pair on login', async () => {
    const service = new AuthService();
    const tokens = await service.login('wid-1');
    expect(tokens.access_token).toBeDefined();
    expect(tokens.refresh_token).toBeDefined();
  });
});
