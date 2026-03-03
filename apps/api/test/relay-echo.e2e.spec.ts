import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Relay echo (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('stores and reads echo payload roundtrip', async () => {
    const ciphertext = Buffer.from('echo-ciphertext').toString('base64');

    const stored = await request(app.getHttpServer())
      .post('/relay/echo')
      .send({
        wid: 'wid-echo-1',
        device_id: 'device-echo-1',
        message_id: 'msg-echo-1',
        ciphertext
      })
      .expect(201);

    expect(stored.body.ciphertext).toBe(ciphertext);

    const fetched = await request(app.getHttpServer())
      .get('/relay/echo/msg-echo-1')
      .query({ wid: 'wid-echo-1', device_id: 'device-echo-1' })
      .expect(200);

    expect(fetched.body.ciphertext).toBe(ciphertext);
  });

  it('maps duplicate submit to 409 without state mutation', async () => {
    const ciphertext = Buffer.from('echo-ciphertext-dup').toString('base64');

    await request(app.getHttpServer())
      .post('/relay/echo')
      .send({
        wid: 'wid-echo-dup',
        device_id: 'device-echo-dup',
        message_id: 'msg-echo-dup',
        ciphertext
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/relay/echo')
      .send({
        wid: 'wid-echo-dup',
        device_id: 'device-echo-dup',
        message_id: 'msg-echo-dup',
        ciphertext
      })
      .expect(409);

    const fetched = await request(app.getHttpServer())
      .get('/relay/echo/msg-echo-dup')
      .query({ wid: 'wid-echo-dup', device_id: 'device-echo-dup' })
      .expect(200);

    expect(fetched.body.ciphertext).toBe(ciphertext);
  });

  it('rejects oversized payload and missing required field', async () => {
    const oversizeCiphertext = Buffer.alloc(65537, 1).toString('base64');

    await request(app.getHttpServer())
      .post('/relay/echo')
      .send({
        wid: 'wid-echo-size',
        device_id: 'device-echo-size',
        message_id: 'msg-echo-size',
        ciphertext: oversizeCiphertext
      })
      .expect(413);

    await request(app.getHttpServer())
      .post('/relay/echo')
      .send({
        wid: 'wid-echo-missing',
        device_id: 'device-echo-missing',
        ciphertext: Buffer.from('small').toString('base64')
      })
      .expect(400);
  });

  it('rejects plaintext-like non-base64 payload', async () => {
    await request(app.getHttpServer())
      .post('/relay/echo')
      .send({
        wid: 'wid-echo-plain',
        device_id: 'device-echo-plain',
        message_id: 'msg-echo-plain',
        ciphertext: 'this-is-plain-text-not-base64'
      })
      .expect(400);
  });
});
