import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Device revocation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('revokes only target device family and keeps other device active', async () => {
    await request(app.getHttpServer())
      .post('/identity/register')
      .send({ wid: 'wid-device-owner', public_key: 'pub-key-owner' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/identity/devices')
      .send({
        wid: 'wid-device-owner',
        device_id: 'device-a',
        device_public_key: 'pub-device-a'
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/identity/devices')
      .send({
        wid: 'wid-device-owner',
        device_id: 'device-b',
        device_public_key: 'pub-device-b'
      })
      .expect(201);

    const deviceA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ wid: 'wid-device-owner', device_id: 'device-a' })
      .expect(201);

    const deviceB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ wid: 'wid-device-owner', device_id: 'device-b' })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/identity/devices/device-a')
      .send({ wid: 'wid-device-owner' })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        wid: 'wid-device-owner',
        device_id: 'device-a',
        refresh_token_value: deviceA.body.refresh_token_value
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        wid: 'wid-device-owner',
        device_id: 'device-b',
        refresh_token_value: deviceB.body.refresh_token_value
      })
      .expect(201);
  });
});
