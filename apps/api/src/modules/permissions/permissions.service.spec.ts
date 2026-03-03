import { PermissionsService } from './permissions.service';
import { BlockRegistryService } from '../../common/state/block-registry.service';

describe('PermissionsService', () => {
  it('returns allow decision scaffold', async () => {
    const service = new PermissionsService(new BlockRegistryService());
    const result = await service.checkDmEligibility({ from_wid: 'a', to_wid: 'b' });
    expect(result.allowed).toBe(true);
    expect(result.deny_reason).toBe('none');
  });
});
