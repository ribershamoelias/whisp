import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Consent and block enforcement (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('denies relay send for blocked pair', async () => {
    await request(app.getHttpServer())
      .post('/identity/register')
      .send({ wid: 'wid-A', public_key: 'pub-A' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/identity/blocks/wid-B')
      .set('x-wid', 'wid-A')
      .send({ wid: 'wid-A' })
      .expect(204);

    await request(app.getHttpServer())
      .post('/relay/messages')
      .send({
        space_id: 'space-1',
        sender_wid: 'wid-B',
        to_wid: 'wid-A',
        ciphertext_blob: 'ciphertext-payload'
      })
      .expect(403);
  });

  it('enforces block for active session token (fail-closed)', async () => {
    await request(app.getHttpServer())
      .post('/identity/register')
      .send({ wid: 'wid-C', public_key: 'pub-C' })
      .expect(201);

    const blockedLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ wid: 'wid-D', device_id: 'device-d1' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/identity/blocks/wid-D')
      .set('x-wid', 'wid-C')
      .send({ wid: 'wid-C' })
      .expect(204);

    await request(app.getHttpServer())
      .post('/relay/messages')
      .set('authorization', `Bearer ${blockedLogin.body.access_token as string}`)
      .send({
        space_id: 'space-2',
        sender_wid: 'wid-D',
        to_wid: 'wid-C',
        ciphertext_blob: 'ciphertext-payload'
      })
      .expect(403);
  });

  it('documents block read-scope: key-bundle reads remain allowed', async () => {
    await request(app.getHttpServer())
      .post('/identity/register')
      .send({ wid: 'wid-E', public_key: 'pub-E' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/identity/register')
      .send({ wid: 'wid-F', public_key: 'pub-F' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/identity/blocks/wid-F')
      .set('x-wid', 'wid-E')
      .send({ wid: 'wid-E' })
      .expect(204);

    await request(app.getHttpServer()).get('/identity/key-bundles/wid-E').expect(200);
  });
});
