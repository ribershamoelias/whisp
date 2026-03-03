import { ConflictException, PayloadTooLargeException } from '@nestjs/common';
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

  it('stores echo payload and returns roundtrip-safe output', async () => {
    const service = new RelayService();
    const ciphertext = Buffer.from('cipher-bytes').toString('base64');
    const saved = await service.submitEcho({
      wid: 'wid-1',
      device_id: 'device-1',
      message_id: 'msg-1',
      ciphertext
    });

    expect(saved.ciphertext).toBe(ciphertext);

    const fetched = await service.getEcho('wid-1', 'device-1', 'msg-1');
    expect(fetched.ciphertext).toBe(ciphertext);
  });

  it('rejects duplicate wid/device/message with conflict', async () => {
    const service = new RelayService();
    const ciphertext = Buffer.from('cipher-bytes').toString('base64');

    await service.submitEcho({
      wid: 'wid-1',
      device_id: 'device-1',
      message_id: 'msg-dup',
      ciphertext
    });

    await expect(
      service.submitEcho({
        wid: 'wid-1',
        device_id: 'device-1',
        message_id: 'msg-dup',
        ciphertext
      })
    ).rejects.toThrow(ConflictException);
  });

  it('rejects payload larger than 65536 bytes', async () => {
    const service = new RelayService();
    const oversizeCiphertext = Buffer.alloc(65537, 1).toString('base64');

    await expect(
      service.submitEcho({
        wid: 'wid-1',
        device_id: 'device-1',
        message_id: 'msg-oversize',
        ciphertext: oversizeCiphertext
      })
    ).rejects.toThrow(PayloadTooLargeException);
  });
});
