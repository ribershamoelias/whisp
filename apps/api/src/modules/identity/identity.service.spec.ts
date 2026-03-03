import { IdentityService } from './identity.service';
import { BlockRegistryService } from '../../common/state/block-registry.service';
import { AuthService } from '../auth/auth.service';

describe('IdentityService', () => {
  it('returns public key bundle shape', async () => {
    const authServiceMock = {
      revokeDeviceSessions: async () => undefined
    } as unknown as AuthService;
    const service = new IdentityService(new BlockRegistryService(), authServiceMock);
    const bundle = await service.getPublicKeyBundle('wid-1');
    expect(bundle.wid).toBe('wid-1');
    expect(bundle.public_key).toBeDefined();
  });
});
