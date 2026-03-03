import { RelayService } from './relay.service';

describe('RelayService', () => {
  it('returns scaffold message id', async () => {
    const service = new RelayService();
    const result = await service.enqueue({
      space_id: 'space-1',
      sender_wid: 'wid-1',
      to_wid: 'wid-2',
      ciphertext_blob: 'cipher'
    });
    expect(result.message_id).toBeDefined();
  });
});
