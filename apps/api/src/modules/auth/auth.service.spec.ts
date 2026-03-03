import { AuthService } from './auth.service';
import { JwtAccessService } from '../../common/auth/jwt-access.service';

describe('AuthService', () => {
  it('returns token pair on login', async () => {
    const service = new AuthService(new JwtAccessService());
    const tokens = await service.login('wid-1');
    expect(tokens.access_token).toBeDefined();
    expect(tokens.refresh_token_value).toBeDefined();
  });
});
