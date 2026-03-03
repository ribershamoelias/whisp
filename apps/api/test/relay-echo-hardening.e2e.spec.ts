import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Relay echo hardening (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts exactly 65536 bytes and rejects 65537 bytes', async () => {
    const boundaryCiphertext = Buffer.alloc(65536, 0x7a).toString('base64');
    await request(app.getHttpServer())
      .post('/relay/echo')
      .send({
        wid: 'wid-boundary',
        device_id: 'device-boundary',
        message_id: 'msg-65536',
        ciphertext: boundaryCiphertext
      })
      .expect(201);

    const oversizeCiphertext = Buffer.alloc(65537, 0x7a).toString('base64');
    await request(app.getHttpServer())
      .post('/relay/echo')
      .send({
        wid: 'wid-boundary',
        device_id: 'device-boundary',
        message_id: 'msg-65537',
        ciphertext: oversizeCiphertext
      })
      .expect(413);
  });

  it('enforces replay contract under concurrent duplicate submit', async () => {
    const ciphertext = Buffer.from('replay-check').toString('base64');

    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post('/relay/echo').send({
        wid: 'wid-replay',
        device_id: 'device-replay',
        message_id: 'msg-replay-race',
        ciphertext
      }),
      request(app.getHttpServer()).post('/relay/echo').send({
        wid: 'wid-replay',
        device_id: 'device-replay',
        message_id: 'msg-replay-race',
        ciphertext
      })
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const fetched = await request(app.getHttpServer())
      .get('/relay/echo/msg-replay-race')
      .query({ wid: 'wid-replay', device_id: 'device-replay' })
      .expect(200);
    expect(fetched.body.ciphertext).toBe(ciphertext);
  });

  it('rejects malformed base64 payload deterministically', async () => {
    const malformed = '-'.repeat(1024);

    await request(app.getHttpServer())
      .post('/relay/echo')
      .send({
        wid: 'wid-malformed',
        device_id: 'device-malformed',
        message_id: 'msg-malformed',
        ciphertext: malformed
      })
      .expect(400);
  });

  it('returns minimal metadata only for echo responses', async () => {
    const ciphertext = Buffer.from('metadata-min').toString('base64');

    const created = await request(app.getHttpServer())
      .post('/relay/echo')
      .send({
        wid: 'wid-meta',
        device_id: 'device-meta',
        message_id: 'msg-meta',
        ciphertext
      })
      .expect(201);

    expect(Object.keys(created.body).sort()).toEqual(
      ['ciphertext', 'created_at', 'device_id', 'message_id', 'wid'].sort()
    );

    const fetched = await request(app.getHttpServer())
      .get('/relay/echo/msg-meta')
      .query({ wid: 'wid-meta', device_id: 'device-meta' })
      .expect(200);

    expect(Object.keys(fetched.body).sort()).toEqual(
      ['ciphertext', 'created_at', 'device_id', 'message_id', 'wid'].sort()
    );
  });

  it('handles boundary load burst without 5xx', async () => {
    const boundaryCiphertext = Buffer.alloc(65536, 0x4d).toString('base64');

    for (let index = 0; index < 12; index += 1) {
      await request(app.getHttpServer())
        .post('/relay/echo')
        .send({
          wid: 'wid-burst',
          device_id: 'device-burst',
          message_id: `msg-burst-${index}`,
          ciphertext: boundaryCiphertext
        })
        .expect(201);
    }
  });
});
