import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('F4 Day1 ordering and idempotency (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates 1to1 conversation and returns deterministic id for same participant pair', async () => {
    const first = await request(app.getHttpServer())
      .post('/relay/conversations')
      .send({ initiator_wid: 'wid-a', target_wid: 'wid-b' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/relay/conversations')
      .send({ initiator_wid: 'wid-b', target_wid: 'wid-a' })
      .expect(201);

    expect(first.body.conversation_id).toBeDefined();
    expect(first.body.conversation_id).toBe(second.body.conversation_id);
    expect(first.body.type).toBe('1to1');
  });

  it('assigns monotonic seq and rejects client-provided seq', async () => {
    const conversation = await request(app.getHttpServer())
      .post('/relay/conversations')
      .send({ initiator_wid: 'wid-c', target_wid: 'wid-d' })
      .expect(201);

    const first = await request(app.getHttpServer())
      .post('/relay/messages/metadata')
      .send({
        conversation_id: conversation.body.conversation_id,
        sender_wid: 'wid-c',
        sender_device_id: 'device-c1',
        client_message_id: 'cmid-1'
      })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/relay/messages/metadata')
      .send({
        conversation_id: conversation.body.conversation_id,
        sender_wid: 'wid-d',
        sender_device_id: 'device-d1',
        client_message_id: 'cmid-2'
      })
      .expect(201);

    expect(first.body.seq).toBe(1);
    expect(second.body.seq).toBe(2);
    expect(first.body.idempotent_replay).toBe(false);

    await request(app.getHttpServer())
      .post('/relay/messages/metadata')
      .send({
        conversation_id: conversation.body.conversation_id,
        sender_wid: 'wid-c',
        sender_device_id: 'device-c1',
        client_message_id: 'cmid-bad',
        seq: 99
      })
      .expect(400);
  });

  it('is idempotent for true retry and rejects duplicate client_message_id across other conversation', async () => {
    const conversationA = await request(app.getHttpServer())
      .post('/relay/conversations')
      .send({ initiator_wid: 'wid-e', target_wid: 'wid-f' })
      .expect(201);
    const conversationB = await request(app.getHttpServer())
      .post('/relay/conversations')
      .send({ initiator_wid: 'wid-e', target_wid: 'wid-g' })
      .expect(201);

    const first = await request(app.getHttpServer())
      .post('/relay/messages/metadata')
      .send({
        conversation_id: conversationA.body.conversation_id,
        sender_wid: 'wid-e',
        sender_device_id: 'device-e1',
        client_message_id: 'cmid-retry'
      })
      .expect(201);

    const retry = await request(app.getHttpServer())
      .post('/relay/messages/metadata')
      .send({
        conversation_id: conversationA.body.conversation_id,
        sender_wid: 'wid-e',
        sender_device_id: 'device-e1',
        client_message_id: 'cmid-retry'
      })
      .expect(201);

    expect(retry.body.seq).toBe(first.body.seq);
    expect(retry.body.idempotent_replay).toBe(true);

    await request(app.getHttpServer())
      .post('/relay/messages/metadata')
      .send({
        conversation_id: conversationB.body.conversation_id,
        sender_wid: 'wid-e',
        sender_device_id: 'device-e1',
        client_message_id: 'cmid-retry'
      })
      .expect(409);
  });

  it('handles concurrent metadata inserts with deterministic unique seq', async () => {
    const conversation = await request(app.getHttpServer())
      .post('/relay/conversations')
      .send({ initiator_wid: 'wid-h', target_wid: 'wid-i' })
      .expect(201);

    const [left, right] = await Promise.all([
      request(app.getHttpServer()).post('/relay/messages/metadata').send({
        conversation_id: conversation.body.conversation_id,
        sender_wid: 'wid-h',
        sender_device_id: 'device-h1',
        client_message_id: 'cmid-left'
      }),
      request(app.getHttpServer()).post('/relay/messages/metadata').send({
        conversation_id: conversation.body.conversation_id,
        sender_wid: 'wid-i',
        sender_device_id: 'device-i1',
        client_message_id: 'cmid-right'
      })
    ]);

    expect([left.status, right.status]).toEqual([201, 201]);
    const seqs = [left.body.seq as number, right.body.seq as number].sort((a, b) => a - b);
    expect(seqs).toEqual([1, 2]);
  });

  it('stores ciphertext message and returns metadata only', async () => {
    const conversation = await request(app.getHttpServer())
      .post('/relay/conversations')
      .send({ initiator_wid: 'wid-j', target_wid: 'wid-k' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/relay/messages/send')
      .send({
        conversation_id: conversation.body.conversation_id,
        sender_wid: 'wid-j',
        sender_device_id: 'device-j1',
        client_message_id: 'cmid-send-1',
        ciphertext: Buffer.from('ciphertext-blob').toString('base64')
      })
      .expect(201);

    expect(response.body.conversation_id).toBe(conversation.body.conversation_id);
    expect(response.body.seq).toBe(1);
    expect(response.body.ciphertext).toBeUndefined();
  });

  it('returns same seq for retry with identical client_message_id and ciphertext', async () => {
    const conversation = await request(app.getHttpServer())
      .post('/relay/conversations')
      .send({ initiator_wid: 'wid-l', target_wid: 'wid-m' })
      .expect(201);
    const payload = {
      conversation_id: conversation.body.conversation_id,
      sender_wid: 'wid-l',
      sender_device_id: 'device-l1',
      client_message_id: 'cmid-send-retry',
      ciphertext: Buffer.from('ciphertext-retry').toString('base64')
    };

    const first = await request(app.getHttpServer()).post('/relay/messages/send').send(payload).expect(201);
    const retry = await request(app.getHttpServer()).post('/relay/messages/send').send(payload).expect(201);

    expect(retry.body.seq).toBe(first.body.seq);
    expect(retry.body.created_at).toBe(first.body.created_at);
  });

  it('rejects invalid base64 and oversized ciphertext payloads', async () => {
    const conversation = await request(app.getHttpServer())
      .post('/relay/conversations')
      .send({ initiator_wid: 'wid-n', target_wid: 'wid-o' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/relay/messages/send')
      .send({
        conversation_id: conversation.body.conversation_id,
        sender_wid: 'wid-n',
        sender_device_id: 'device-n1',
        client_message_id: 'cmid-send-bad',
        ciphertext: 'YQ==='
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/relay/messages/send')
      .send({
        conversation_id: conversation.body.conversation_id,
        sender_wid: 'wid-n',
        sender_device_id: 'device-n1',
        client_message_id: 'cmid-send-big',
        ciphertext: Buffer.alloc(65537, 1).toString('base64')
      })
      .expect(413);
  });

  it('rejects idempotency key reuse with different conversation and keeps seq deterministic under concurrency', async () => {
    const conversationA = await request(app.getHttpServer())
      .post('/relay/conversations')
      .send({ initiator_wid: 'wid-p', target_wid: 'wid-q' })
      .expect(201);
    const conversationB = await request(app.getHttpServer())
      .post('/relay/conversations')
      .send({ initiator_wid: 'wid-p', target_wid: 'wid-r' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/relay/messages/send')
      .send({
        conversation_id: conversationA.body.conversation_id,
        sender_wid: 'wid-p',
        sender_device_id: 'device-p1',
        client_message_id: 'cmid-send-conflict',
        ciphertext: Buffer.from('ciphertext-conflict').toString('base64')
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/relay/messages/send')
      .send({
        conversation_id: conversationB.body.conversation_id,
        sender_wid: 'wid-p',
        sender_device_id: 'device-p1',
        client_message_id: 'cmid-send-conflict',
        ciphertext: Buffer.from('ciphertext-conflict').toString('base64')
      })
      .expect(409);

    const concurrentConversation = await request(app.getHttpServer())
      .post('/relay/conversations')
      .send({ initiator_wid: 'wid-s', target_wid: 'wid-t' })
      .expect(201);

    const [left, right] = await Promise.all([
      request(app.getHttpServer()).post('/relay/messages/send').send({
        conversation_id: concurrentConversation.body.conversation_id,
        sender_wid: 'wid-s',
        sender_device_id: 'device-s1',
        client_message_id: 'cmid-send-left',
        ciphertext: Buffer.from('left').toString('base64')
      }),
      request(app.getHttpServer()).post('/relay/messages/send').send({
        conversation_id: concurrentConversation.body.conversation_id,
        sender_wid: 'wid-t',
        sender_device_id: 'device-t1',
        client_message_id: 'cmid-send-right',
        ciphertext: Buffer.from('right').toString('base64')
      })
    ]);

    expect([left.status, right.status]).toEqual([201, 201]);
    const seqs = [left.body.seq as number, right.body.seq as number].sort((a, b) => a - b);
    expect(seqs).toEqual([1, 2]);
  });

  it('creates device-scoped delivery rows on send and keeps retries idempotent', async () => {
    await request(app.getHttpServer())
      .post('/identity/devices')
      .send({ wid: 'wid-v', device_id: 'device-v1', device_public_key: 'pub-v1' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/identity/devices')
      .send({ wid: 'wid-v', device_id: 'device-v2', device_public_key: 'pub-v2' })
      .expect(201);

    const conversation = await request(app.getHttpServer())
      .post('/relay/conversations')
      .send({ initiator_wid: 'wid-u', target_wid: 'wid-v' })
      .expect(201);

    const payload = {
      conversation_id: conversation.body.conversation_id,
      sender_wid: 'wid-u',
      sender_device_id: 'device-u1',
      client_message_id: 'cmid-delivery-idem',
      ciphertext: Buffer.from('ciphertext-delivery').toString('base64')
    };

    const first = await request(app.getHttpServer()).post('/relay/messages/send').send(payload).expect(201);
    const retry = await request(app.getHttpServer()).post('/relay/messages/send').send(payload).expect(201);

    expect(retry.body.seq).toBe(first.body.seq);

    await request(app.getHttpServer())
      .post('/relay/messages/delivered')
      .send({
        conversation_id: conversation.body.conversation_id,
        seq: first.body.seq,
        target_wid: 'wid-v',
        target_device_id: 'device-v1'
      })
      .expect(204);

    await request(app.getHttpServer())
      .post('/relay/messages/delivered')
      .send({
        conversation_id: conversation.body.conversation_id,
        seq: first.body.seq,
        target_wid: 'wid-v',
        target_device_id: 'device-v2'
      })
      .expect(204);
  });

  it('tracks delivered and read state per device and rejects read before delivered', async () => {
    await request(app.getHttpServer())
      .post('/identity/devices')
      .send({ wid: 'wid-x', device_id: 'device-x1', device_public_key: 'pub-x1' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/identity/devices')
      .send({ wid: 'wid-x', device_id: 'device-x2', device_public_key: 'pub-x2' })
      .expect(201);

    const conversation = await request(app.getHttpServer())
      .post('/relay/conversations')
      .send({ initiator_wid: 'wid-w', target_wid: 'wid-x' })
      .expect(201);

    const sent = await request(app.getHttpServer())
      .post('/relay/messages/send')
      .send({
        conversation_id: conversation.body.conversation_id,
        sender_wid: 'wid-w',
        sender_device_id: 'device-w1',
        client_message_id: 'cmid-read-state',
        ciphertext: Buffer.from('ciphertext-read').toString('base64')
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/relay/messages/read')
      .send({
        conversation_id: conversation.body.conversation_id,
        seq: sent.body.seq,
        target_wid: 'wid-x',
        target_device_id: 'device-x1'
      })
      .expect(409);

    await request(app.getHttpServer())
      .post('/relay/messages/delivered')
      .send({
        conversation_id: conversation.body.conversation_id,
        seq: sent.body.seq,
        target_wid: 'wid-x',
        target_device_id: 'device-x1'
      })
      .expect(204);

    await request(app.getHttpServer())
      .post('/relay/messages/read')
      .send({
        conversation_id: conversation.body.conversation_id,
        seq: sent.body.seq,
        target_wid: 'wid-x',
        target_device_id: 'device-x1'
      })
      .expect(204);

    await request(app.getHttpServer())
      .post('/relay/messages/read')
      .send({
        conversation_id: conversation.body.conversation_id,
        seq: sent.body.seq,
        target_wid: 'wid-x',
        target_device_id: 'device-x1'
      })
      .expect(204);

    await request(app.getHttpServer())
      .post('/relay/messages/read')
      .send({
        conversation_id: conversation.body.conversation_id,
        seq: sent.body.seq,
        target_wid: 'wid-x',
        target_device_id: 'device-x2'
      })
      .expect(409);
  });

  it('returns 404 for unknown delivery rows and 400 for invalid delivery payloads', async () => {
    await request(app.getHttpServer())
      .post('/relay/messages/delivered')
      .send({
        conversation_id: '11111111-1111-4111-8111-111111111111',
        seq: 1,
        target_wid: 'wid-missing',
        target_device_id: 'device-missing'
      })
      .expect(404);

    await request(app.getHttpServer())
      .post('/relay/messages/read')
      .send({
        conversation_id: '11111111-1111-4111-8111-111111111111',
        seq: 0,
        target_wid: 'wid-missing',
        target_device_id: 'device-missing',
        unauthorized: true
      })
      .expect(400);
  });
});
