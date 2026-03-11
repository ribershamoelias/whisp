import { BadRequestException, ConflictException, PayloadTooLargeException } from '@nestjs/common';
import { RelayService } from './relay.service';

describe('RelayService', () => {
  const createService = (devicesByWid: Record<string, string[]> = {}): RelayService =>
    new RelayService({
      listDeviceIds: async (wid: string) => devicesByWid[wid] ?? []
    } as any);

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

  it('creates deterministic 1to1 conversations by participant pair', async () => {
    const service = new RelayService();
    const first = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });
    const second = await service.createConversation({
      initiator_wid: 'wid-2',
      target_wid: 'wid-1'
    });

    expect(first.conversation_id).toBe(second.conversation_id);
    expect(first.type).toBe('1to1');
  });

  it('rejects self-conversation and detects corrupted pair index', async () => {
    const service = new RelayService();

    await expect(
      service.createConversation({
        initiator_wid: 'wid-1',
        target_wid: 'wid-1'
      })
    ).rejects.toThrow(BadRequestException);

    const corruptedService = service as any;
    corruptedService.conversationByPair.set('wid-2::wid-3', 'missing-conversation');

    await expect(
      corruptedService.createConversation({
        initiator_wid: 'wid-2',
        target_wid: 'wid-3'
      })
    ).rejects.toThrow(ConflictException);
  });

  it('stores metadata with server-assigned monotonic seq', async () => {
    const service = new RelayService();
    const conversation = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });

    const first = await service.storeMessageMetadata({
      conversation_id: conversation.conversation_id,
      sender_wid: 'wid-1',
      sender_device_id: 'device-1',
      client_message_id: 'cmid-1'
    });
    const second = await service.storeMessageMetadata({
      conversation_id: conversation.conversation_id,
      sender_wid: 'wid-2',
      sender_device_id: 'device-2',
      client_message_id: 'cmid-2'
    });

    expect(first.seq).toBe(1);
    expect(second.seq).toBe(2);
    expect(first.idempotent_replay).toBe(false);
  });

  it('stores ciphertext message and returns metadata without plaintext exposure', async () => {
    const service = createService({ 'wid-2': ['device-2a', 'device-2b'] });
    const conversation = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });

    const stored = await service.sendCiphertextMessage({
      conversation_id: conversation.conversation_id,
      sender_wid: 'wid-1',
      sender_device_id: 'device-1',
      client_message_id: 'cmid-send-1',
      ciphertext: Buffer.from('ciphertext-blob').toString('base64')
    });

    expect(stored.seq).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(stored, 'ciphertext_blob')).toBe(false);
    const deliveryStateStore = (service as any).deliveryStateStore as Map<string, unknown>;
    expect(deliveryStateStore.size).toBe(2);
  });

  it('returns same seq for idempotent ciphertext retry', async () => {
    const service = createService({ 'wid-2': ['device-2a', 'device-2b'] });
    const conversation = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });
    const payload = {
      conversation_id: conversation.conversation_id,
      sender_wid: 'wid-1',
      sender_device_id: 'device-1',
      client_message_id: 'cmid-send-idem',
      ciphertext: Buffer.from('ciphertext-blob').toString('base64')
    };

    const first = await service.sendCiphertextMessage(payload);
    const retry = await service.sendCiphertextMessage(payload);
    const deliveryStateStore = (service as any).deliveryStateStore as Map<string, unknown>;

    expect(retry.seq).toBe(first.seq);
    expect(deliveryStateStore.size).toBe(2);
  });

  it('rejects ciphertext retry when same idempotency key changes conversation or payload', async () => {
    const service = new RelayService();
    const conversationA = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });
    const conversationB = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-3'
    });

    await service.sendCiphertextMessage({
      conversation_id: conversationA.conversation_id,
      sender_wid: 'wid-1',
      sender_device_id: 'device-1',
      client_message_id: 'cmid-send-conflict',
      ciphertext: Buffer.from('ciphertext-a').toString('base64')
    });

    await expect(
      service.sendCiphertextMessage({
        conversation_id: conversationB.conversation_id,
        sender_wid: 'wid-1',
        sender_device_id: 'device-1',
        client_message_id: 'cmid-send-conflict',
        ciphertext: Buffer.from('ciphertext-a').toString('base64')
      })
    ).rejects.toThrow(ConflictException);

    await expect(
      service.sendCiphertextMessage({
        conversation_id: conversationA.conversation_id,
        sender_wid: 'wid-1',
        sender_device_id: 'device-1',
        client_message_id: 'cmid-send-conflict',
        ciphertext: Buffer.from('ciphertext-b').toString('base64')
      })
    ).rejects.toThrow(ConflictException);
  });

  it('rejects invalid base64 and oversized ciphertext for send endpoint', async () => {
    const service = new RelayService();
    const conversation = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });

    await expect(
      service.sendCiphertextMessage({
        conversation_id: conversation.conversation_id,
        sender_wid: 'wid-1',
        sender_device_id: 'device-1',
        client_message_id: 'cmid-send-bad',
        ciphertext: 'YQ==='
      })
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.sendCiphertextMessage({
        conversation_id: conversation.conversation_id,
        sender_wid: 'wid-1',
        sender_device_id: 'device-1',
        client_message_id: 'cmid-send-oversize',
        ciphertext: Buffer.alloc(65537, 1).toString('base64')
      })
    ).rejects.toThrow(PayloadTooLargeException);

    await expect(
      service.sendCiphertextMessage({
        conversation_id: conversation.conversation_id,
        sender_wid: 'wid-1',
        sender_device_id: 'device-1',
        client_message_id: 'cmid-send-seq',
        ciphertext: Buffer.from('ciphertext-blob').toString('base64'),
        seq: 7
      } as any)
    ).rejects.toThrow('seq must not be provided by client');
  });

  it('handles concurrent ciphertext sends with deterministic unique seq', async () => {
    const service = createService({ 'wid-1': ['device-1b'], 'wid-2': ['device-2b'] });
    const conversation = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });

    const [left, right] = await Promise.all([
      service.sendCiphertextMessage({
        conversation_id: conversation.conversation_id,
        sender_wid: 'wid-1',
        sender_device_id: 'device-1',
        client_message_id: 'cmid-send-left',
        ciphertext: Buffer.from('left').toString('base64')
      }),
      service.sendCiphertextMessage({
        conversation_id: conversation.conversation_id,
        sender_wid: 'wid-2',
        sender_device_id: 'device-2',
        client_message_id: 'cmid-send-right',
        ciphertext: Buffer.from('right').toString('base64')
      })
    ]);

    const seqs = [left.seq, right.seq].sort((a, b) => a - b);
    expect(seqs).toEqual([1, 2]);
  });

  it('marks delivery per target device without affecting sibling devices', async () => {
    const service = createService({ 'wid-2': ['device-2a', 'device-2b'] });
    const conversation = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });

    const stored = await service.sendCiphertextMessage({
      conversation_id: conversation.conversation_id,
      sender_wid: 'wid-1',
      sender_device_id: 'device-1',
      client_message_id: 'cmid-delivery',
      ciphertext: Buffer.from('ciphertext-blob').toString('base64')
    });

    await service.markDelivered({
      conversation_id: conversation.conversation_id,
      seq: stored.seq,
      target_wid: 'wid-2',
      target_device_id: 'device-2a'
    });
    await service.markDelivered({
      conversation_id: conversation.conversation_id,
      seq: stored.seq,
      target_wid: 'wid-2',
      target_device_id: 'device-2a'
    });

    const deliveryStateStore = (service as any).deliveryStateStore as Map<string, any>;
    const a = deliveryStateStore.get(`${conversation.conversation_id}::${stored.seq}::device-2a`);
    const b = deliveryStateStore.get(`${conversation.conversation_id}::${stored.seq}::device-2b`);
    expect(a.delivered_at).toBeTruthy();
    expect(a.read_at).toBeNull();
    expect(b.delivered_at).toBeNull();

    await expect(
      service.markDelivered({
        conversation_id: conversation.conversation_id,
        seq: stored.seq,
        target_wid: 'wid-2',
        target_device_id: 'device-unknown'
      })
    ).rejects.toThrow('delivery row not found');
  });

  it('marks read only after delivery and keeps device state isolated', async () => {
    const service = createService({ 'wid-2': ['device-2a', 'device-2b'] });
    const conversation = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });

    const stored = await service.sendCiphertextMessage({
      conversation_id: conversation.conversation_id,
      sender_wid: 'wid-1',
      sender_device_id: 'device-1',
      client_message_id: 'cmid-read',
      ciphertext: Buffer.from('ciphertext-blob').toString('base64')
    });

    await expect(
      service.markRead({
        conversation_id: conversation.conversation_id,
        seq: stored.seq,
        target_wid: 'wid-2',
        target_device_id: 'device-2a'
      })
    ).rejects.toThrow(ConflictException);

    await service.markDelivered({
      conversation_id: conversation.conversation_id,
      seq: stored.seq,
      target_wid: 'wid-2',
      target_device_id: 'device-2a'
    });
    await service.markRead({
      conversation_id: conversation.conversation_id,
      seq: stored.seq,
      target_wid: 'wid-2',
      target_device_id: 'device-2a'
    });
    await service.markRead({
      conversation_id: conversation.conversation_id,
      seq: stored.seq,
      target_wid: 'wid-2',
      target_device_id: 'device-2a'
    });

    const deliveryStateStore = (service as any).deliveryStateStore as Map<string, any>;
    const a = deliveryStateStore.get(`${conversation.conversation_id}::${stored.seq}::device-2a`);
    const b = deliveryStateStore.get(`${conversation.conversation_id}::${stored.seq}::device-2b`);
    expect(a.delivered_at).toBeTruthy();
    expect(a.read_at).toBeTruthy();
    expect(b.read_at).toBeNull();
  });

  it('rejects unknown delivery rows, invalid payload, and read/write requests with extra fields', async () => {
    const service = createService();

    await expect(service.markDelivered('invalid')).rejects.toThrow(BadRequestException);
    await expect(
      service.markDelivered({
        conversation_id: '11111111-1111-4111-8111-111111111111',
        seq: 1,
        target_wid: 'wid-missing',
        target_device_id: 'device-missing'
      })
    ).rejects.toThrow('message not found');
    await expect(
      service.markRead({
        conversation_id: '22222222-2222-4222-8222-222222222222',
        seq: 1,
        target_wid: 'wid-missing',
        target_device_id: 'device-missing'
      })
    ).rejects.toThrow('message not found');
    await expect(
      service.markRead({
        conversation_id: '22222222-2222-4222-8222-222222222222',
        seq: 1,
        target_wid: 'wid-missing',
        target_device_id: 'device-missing',
        unauthorized: true
      } as any)
    ).rejects.toThrow('unexpected field: unauthorized');
  });

  it('rejects delivery payloads with invalid seq or invalid conversation uuid', async () => {
    const service = createService();

    await expect(
      service.markDelivered({
        conversation_id: 'not-a-uuid',
        seq: 1,
        target_wid: 'wid-1',
        target_device_id: 'device-1'
      })
    ).rejects.toThrow('conversation_id must be a valid uuid');

    await expect(
      service.markRead({
        conversation_id: '11111111-1111-4111-8111-111111111111',
        seq: 0,
        target_wid: 'wid-1',
        target_device_id: 'device-1'
      })
    ).rejects.toThrow('seq must be a positive integer');
  });

  it('rejects read when delivery row target_wid does not match and ignores duplicate device ids on creation', async () => {
    const service = createService({ 'wid-2': ['device-2a', 'device-2a'] });
    const conversation = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });

    const stored = await service.sendCiphertextMessage({
      conversation_id: conversation.conversation_id,
      sender_wid: 'wid-1',
      sender_device_id: 'device-1',
      client_message_id: 'cmid-dup-devices',
      ciphertext: Buffer.from('ciphertext-blob').toString('base64')
    });

    const deliveryStateStore = (service as any).deliveryStateStore as Map<string, any>;
    expect(deliveryStateStore.size).toBe(1);

    await expect(
      service.markRead({
        conversation_id: conversation.conversation_id,
        seq: stored.seq,
        target_wid: 'wid-other',
        target_device_id: 'device-2a'
      })
    ).rejects.toThrow('delivery row not found');
  });

  it('fails closed when conversation target resolution is corrupted', async () => {
    const service = createService({ 'wid-2': ['device-2a'] });
    const conversation = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });

    const corruptedService = service as any;
    corruptedService.conversations.set(conversation.conversation_id, {
      ...corruptedService.conversations.get(conversation.conversation_id),
      participants: ['wid-1', 'wid-1']
    });

    await expect(
      service.sendCiphertextMessage({
        conversation_id: conversation.conversation_id,
        sender_wid: 'wid-1',
        sender_device_id: 'device-1',
        client_message_id: 'cmid-corrupt-target',
        ciphertext: Buffer.from('ciphertext-blob').toString('base64')
      })
    ).rejects.toThrow('conversation target resolution failed');
  });

  it('rejects invalid ciphertext send payload, unknown conversation, outsider sender, and empty canonical payload', async () => {
    const service = new RelayService();

    await expect(service.sendCiphertextMessage('invalid')).rejects.toThrow(BadRequestException);

    await expect(
      service.sendCiphertextMessage({
        conversation_id: 'missing-conversation',
        sender_wid: 'wid-1',
        sender_device_id: 'device-1',
        client_message_id: 'cmid-missing',
        ciphertext: Buffer.from('cipher').toString('base64')
      })
    ).rejects.toThrow('conversation not found');

    const conversation = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });

    await expect(
      service.sendCiphertextMessage({
        conversation_id: conversation.conversation_id,
        sender_wid: 'wid-3',
        sender_device_id: 'device-3',
        client_message_id: 'cmid-outsider',
        ciphertext: Buffer.from('cipher').toString('base64')
      })
    ).rejects.toThrow('sender_wid is not a participant of the conversation');

    await expect(
      service.sendCiphertextMessage({
        conversation_id: conversation.conversation_id,
        sender_wid: 'wid-1',
        sender_device_id: 'device-1',
        client_message_id: 'cmid-empty',
        ciphertext: '===='
      })
    ).rejects.toThrow('ciphertext must not be empty');
  });

  it('returns deterministic response for idempotent duplicate message insert', async () => {
    const service = new RelayService();
    const conversation = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });

    const first = await service.storeMessageMetadata({
      conversation_id: conversation.conversation_id,
      sender_wid: 'wid-1',
      sender_device_id: 'device-1',
      client_message_id: 'cmid-idem'
    });
    const duplicate = await service.storeMessageMetadata({
      conversation_id: conversation.conversation_id,
      sender_wid: 'wid-1',
      sender_device_id: 'device-1',
      client_message_id: 'cmid-idem'
    });

    expect(duplicate.seq).toBe(first.seq);
    expect(duplicate.idempotent_replay).toBe(true);
  });

  it('rejects duplicate client_message_id reuse across different conversation', async () => {
    const service = new RelayService();
    const conversationA = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });
    const conversationB = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-3'
    });

    await service.storeMessageMetadata({
      conversation_id: conversationA.conversation_id,
      sender_wid: 'wid-1',
      sender_device_id: 'device-1',
      client_message_id: 'cmid-dup'
    });

    await expect(
      service.storeMessageMetadata({
        conversation_id: conversationB.conversation_id,
        sender_wid: 'wid-1',
        sender_device_id: 'device-1',
        client_message_id: 'cmid-dup'
      })
    ).rejects.toThrow(ConflictException);
  });

  it('handles concurrent metadata insert with deterministic unique seq', async () => {
    const service = new RelayService();
    const conversation = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });

    const [a, b] = await Promise.all([
      service.storeMessageMetadata({
        conversation_id: conversation.conversation_id,
        sender_wid: 'wid-1',
        sender_device_id: 'device-a',
        client_message_id: 'cmid-a'
      }),
      service.storeMessageMetadata({
        conversation_id: conversation.conversation_id,
        sender_wid: 'wid-2',
        sender_device_id: 'device-b',
        client_message_id: 'cmid-b'
      })
    ]);

    const seqs = [a.seq, b.seq].sort((left, right) => left - right);
    expect(seqs).toEqual([1, 2]);
  });

  it('rejects client-provided seq in metadata payload', async () => {
    const service = new RelayService();
    const conversation = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });

    await expect(
      service.storeMessageMetadata({
        conversation_id: conversation.conversation_id,
        sender_wid: 'wid-1',
        sender_device_id: 'device-1',
        client_message_id: 'cmid-bad',
        seq: 99
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid metadata payload, missing conversation, and outsider sender', async () => {
    const service = new RelayService();

    await expect(service.storeMessageMetadata('invalid')).rejects.toThrow(BadRequestException);

    await expect(
      service.storeMessageMetadata({
        conversation_id: 'missing-conversation',
        sender_wid: 'wid-1',
        sender_device_id: 'device-1',
        client_message_id: 'cmid-missing'
      })
    ).rejects.toThrow('conversation not found');

    const conversation = await service.createConversation({
      initiator_wid: 'wid-1',
      target_wid: 'wid-2'
    });

    await expect(
      service.storeMessageMetadata({
        conversation_id: conversation.conversation_id,
        sender_wid: 'wid-3',
        sender_device_id: 'device-3',
        client_message_id: 'cmid-outsider'
      })
    ).rejects.toThrow('sender_wid is not a participant of the conversation');
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

  it('returns scaffold list item by space', async () => {
    const service = new RelayService();
    const list = await service.listBySpace('space-abc');
    expect(list).toHaveLength(1);
    expect(list[0].space_id).toBe('space-abc');
  });

  it('rejects getEcho when record does not exist', async () => {
    const service = new RelayService();
    await expect(service.getEcho('wid-missing', 'device-missing', 'msg-missing')).rejects.toThrow(
      'echo message not found'
    );
  });

  it('rejects missing required fields before processing', async () => {
    const service = new RelayService();
    const ciphertext = Buffer.from('cipher').toString('base64');

    await expect(
      service.submitEcho({
        wid: 'wid-1',
        device_id: 'device-1',
        message_id: '',
        ciphertext
      })
    ).rejects.toThrow('missing required field: message_id');
  });

  it('rejects non-canonical base64 payload', async () => {
    const service = new RelayService();

    await expect(
      service.submitEcho({
        wid: 'wid-1',
        device_id: 'device-1',
        message_id: 'msg-non-canonical',
        ciphertext: 'YQ==='
      })
    ).rejects.toThrow('ciphertext must be canonical base64');
  });

  it('rejects zero-length decoded payload', async () => {
    const service = new RelayService();

    await expect(
      service.submitEcho({
        wid: 'wid-1',
        device_id: 'device-1',
        message_id: 'msg-empty',
        ciphertext: '===='
      })
    ).rejects.toThrow('ciphertext must not be empty');
  });
});
