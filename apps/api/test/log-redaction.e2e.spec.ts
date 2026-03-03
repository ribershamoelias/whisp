import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { LOG_SINK, LogSink } from '../src/common/logging/safe-logger.service';

class MemoryLogSink implements LogSink {
  lines: string[] = [];

  write(line: string): void {
    this.lines.push(line);
  }
}

describe('Log redaction (e2e)', () => {
  let app: INestApplication;
  let sink: MemoryLogSink;

  beforeAll(async () => {
    sink = new MemoryLogSink();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(LOG_SINK)
      .useValue(sink)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('redacts auth header and token fields', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ wid: 'wid-1', device_id: 'device-a' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('authorization', `Bearer ${loginResponse.body.access_token as string}`)
      .send({
        wid: 'wid-1',
        device_id: 'device-a',
        refresh_token_value: loginResponse.body.refresh_token_value as string
      })
      .expect(201);

    const echoCiphertext = Buffer.from('echo-sensitive-ciphertext').toString('base64');
    const binaryEchoCiphertext = Buffer.from(
      Array.from({ length: 1024 }, (_value, index) => index % 256)
    ).toString('base64');
    await request(app.getHttpServer())
      .post('/relay/echo')
      .send({
        wid: 'wid-echo-log',
        device_id: 'device-echo-log',
        message_id: 'msg-echo-log',
        ciphertext: echoCiphertext
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/relay/echo')
      .send({
        wid: 'wid-echo-log',
        device_id: 'device-echo-log',
        message_id: 'msg-echo-log-binary',
        ciphertext: binaryEchoCiphertext
      })
      .expect(201);

    const logBody = sink.lines.join('\n');
    expect(logBody).toContain('[REDACTED]');
    expect(logBody).not.toContain(loginResponse.body.access_token as string);
    expect(logBody).not.toContain(loginResponse.body.refresh_token_value as string);
    expect(logBody).not.toContain(echoCiphertext);
    expect(logBody).not.toContain(binaryEchoCiphertext);
  });
});
