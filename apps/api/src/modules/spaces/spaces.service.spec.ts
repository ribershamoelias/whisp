import { SpacesService } from './spaces.service';

describe('SpacesService', () => {
  it('creates scaffold space id', async () => {
    const service = new SpacesService();
    const result = await service.createSpace({ type: 'public', public_flag: true });
    expect(result.space_id).toBeDefined();
  });
});
