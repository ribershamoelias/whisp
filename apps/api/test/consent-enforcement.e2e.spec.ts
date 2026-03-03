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
      .send({})
      .expect(201);

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
});
