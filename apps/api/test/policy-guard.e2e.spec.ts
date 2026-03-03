import { Controller, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PolicyGuard } from '../src/common/authz/policy.guard';
import { PermissionsService } from '../src/modules/permissions/permissions.service';

@Controller()
class MissingPolicyController {
  @Post('mutate')
  mutate(): { ok: boolean } {
    return { ok: true };
  }
}

describe('PolicyGuard (e2e fail-closed)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MissingPolicyController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: PolicyGuard
        },
        {
          provide: PermissionsService,
          useValue: { authorize: async () => ({ allowed: true, deny_reason: 'none' }) }
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects mutating endpoint without @RequiresPolicy', async () => {
    const response = await request(app.getHttpServer()).post('/mutate').send({ wid: 'wid-1' }).expect(500);
    expect(String(response.body.message)).toContain('missing @RequiresPolicy');
  });
});
