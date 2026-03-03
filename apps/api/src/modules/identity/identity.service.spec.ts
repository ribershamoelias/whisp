import { IdentityService } from './identity.service';
import { BlockRegistryService } from '../../common/state/block-registry.service';
import { AuthService } from '../auth/auth.service';

describe('IdentityService', () => {
  let blockRegistry: BlockRegistryService;
  let authServiceMock: AuthService;
  let service: IdentityService;

  beforeEach(() => {
    blockRegistry = new BlockRegistryService();
    authServiceMock = {
      revokeDeviceSessions: async () => undefined
    } as unknown as AuthService;
    service = new IdentityService(blockRegistry, authServiceMock);
  });

  it('returns public key bundle shape', async () => {
    const bundle = await service.getPublicKeyBundle('wid-1');
    expect(bundle.wid).toBe('wid-1');
    expect(bundle.public_key).toBeDefined();
  });

  it('registers and revokes devices in bundle', async () => {
    await service.registerDevice({ wid: 'wid-1', device_id: 'dev-1', device_public_key: 'pk-1' });
    await service.registerDevice({ wid: 'wid-1', device_id: 'dev-2', device_public_key: 'pk-2' });

    const before = await service.getPublicKeyBundle('wid-1');
    expect(before.devices).toHaveLength(2);

    await service.revokeDevice('wid-1', 'dev-1');
    const after = await service.getPublicKeyBundle('wid-1');
    expect(after.devices).toHaveLength(1);
    expect(after.devices[0].device_id).toBe('dev-2');
  });

  it('block/unblock mutates registry deterministically', async () => {
    await service.block('wid-a', 'wid-b');
    expect(blockRegistry.isBlocked('wid-a', 'wid-b')).toBe(true);

    await service.unblock('wid-a', 'wid-b');
    expect(blockRegistry.isBlocked('wid-a', 'wid-b')).toBe(false);
  });
});
