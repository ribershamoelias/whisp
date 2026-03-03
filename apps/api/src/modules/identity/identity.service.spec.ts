import { IdentityService } from './identity.service';
import { BlockRegistryService } from '../../common/state/block-registry.service';

describe('IdentityService', () => {
  it('returns public key bundle shape', async () => {
    const service = new IdentityService(new BlockRegistryService());
    const bundle = await service.getPublicKeyBundle('wid-1');
    expect(bundle.wid).toBe('wid-1');
    expect(bundle.public_key).toBeDefined();
  });
});
