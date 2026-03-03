import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login returns token shape', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ wid: 'wid-1', device_id: 'device-a' })
      .expect(201);

    expect(loginResponse.body.access_token).toBeDefined();
    expect(loginResponse.body.refresh_token_value).toBeDefined();

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('authorization', `Bearer ${loginResponse.body.access_token as string}`)
      .send({
        wid: 'wid-1',
        device_id: 'device-a',
        refresh_token_value: loginResponse.body.refresh_token_value
      })
      .expect(201);

    expect(refreshResponse.body.access_token).toBeDefined();
    expect(refreshResponse.body.refresh_token_value).toBeDefined();

    await request(app.getHttpServer()).post('/auth/logout').send({ wid: 'wid-1' }).expect(201);
  });
});
