import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('PreKey bundle infrastructure (e2e)', () => {
  let app: INestApplication;

  const baseBundle = {
    wid: 'wid-prekey',
    device_id: 'device-prekey',
    identity_key: 'identity-public-key-1',
    signed_prekey: {
      signed_prekey_id: 1,
      signed_prekey_public: 'signed-prekey-public-1',
      signature: 'signed-prekey-signature-1'
    },
    one_time_prekeys: [
      { prekey_id: 11, public_key: 'opk-public-11' },
      { prekey_id: 12, public_key: 'opk-public-12' }
    ]
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('uploads prekey bundle successfully', async () => {
    await request(app.getHttpServer())
      .post('/identity/prekey-bundle')
      .send(baseBundle)
      .expect(201);
  });

  it('rejects duplicate bundle upload deterministically', async () => {
    await request(app.getHttpServer())
      .post('/identity/prekey-bundle')
      .send({
        ...baseBundle,
        wid: 'wid-dup',
        device_id: 'device-dup'
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/identity/prekey-bundle')
      .send({
        ...baseBundle,
        wid: 'wid-dup',
        device_id: 'device-dup'
      })
      .expect(409);
  });

  it('fetches unused prekeys and depletes deterministically', async () => {
    await request(app.getHttpServer())
      .post('/identity/prekey-bundle')
      .send({
        ...baseBundle,
        wid: 'wid-fetch',
        device_id: 'device-fetch'
      })
      .expect(201);

    const first = await request(app.getHttpServer())
      .get('/identity/prekey-bundle/wid-fetch/device-fetch')
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/identity/prekey-bundle/wid-fetch/device-fetch')
      .expect(200);

    expect(first.body.one_time_prekey.prekey_id).not.toBe(second.body.one_time_prekey.prekey_id);

    await request(app.getHttpServer())
      .get('/identity/prekey-bundle/wid-fetch/device-fetch')
      .expect(409);
  });

  it('concurrent fetch serves a one-time prekey only once', async () => {
    await request(app.getHttpServer())
      .post('/identity/prekey-bundle')
      .send({
        ...baseBundle,
        wid: 'wid-race',
        device_id: 'device-race',
        one_time_prekeys: [{ prekey_id: 500, public_key: 'opk-500' }]
      })
      .expect(201);

    const [first, second] = await Promise.all([
      request(app.getHttpServer()).get('/identity/prekey-bundle/wid-race/device-race'),
      request(app.getHttpServer()).get('/identity/prekey-bundle/wid-race/device-race')
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it('rejects identity key change for existing wid/device', async () => {
    await request(app.getHttpServer())
      .post('/identity/prekey-bundle')
      .send({
        ...baseBundle,
        wid: 'wid-immutable',
        device_id: 'device-immutable',
        identity_key: 'identity-public-key-original'
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/identity/prekey-bundle')
      .send({
        ...baseBundle,
        wid: 'wid-immutable',
        device_id: 'device-immutable',
        identity_key: 'identity-public-key-changed'
      })
      .expect(409);
  });

  it('rejects bundle without signed prekey and rejects forbidden sensitive key field', async () => {
    await request(app.getHttpServer())
      .post('/identity/prekey-bundle')
      .send({
        wid: 'wid-invalid',
        device_id: 'device-invalid',
        identity_key: 'identity-public-key',
        one_time_prekeys: [{ prekey_id: 1, public_key: 'opk' }]
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/identity/prekey-bundle')
      .send({
        ...baseBundle,
        wid: 'wid-private',
        device_id: 'device-private',
        shared_secret_blob: 'must-never-be-accepted'
      })
      .expect(400);
  });
});
