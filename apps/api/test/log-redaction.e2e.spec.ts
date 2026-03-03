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
      .send({ wid: 'wid-1' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('authorization', `Bearer ${loginResponse.body.access_token as string}`)
      .send({ wid: 'wid-1', refresh_token_value: 'refresh-redaction-value' })
      .expect(201);

    const logBody = sink.lines.join('\n');
    expect(logBody).toContain('[REDACTED]');
    expect(logBody).not.toContain(loginResponse.body.access_token as string);
    expect(logBody).not.toContain('refresh-redaction-value');
  });
});
