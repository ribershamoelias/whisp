import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth signature validation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects invalid bearer signature with 401', async () => {
    await request(app.getHttpServer())
      .post('/identity/blocks/wid-target')
      .set('authorization', 'Bearer invalid.signature.payload')
      .send({ wid: 'wid-1' })
      .expect(401);
  });
});
