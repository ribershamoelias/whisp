import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtAccessService } from '../../common/auth/jwt-access.service';
import { hashRefreshToken, verifyRefreshTokenConstantTime } from './refresh-token-crypto';
import { InMemoryRefreshTokenStore } from './refresh-token.store';

export interface AuthTokens {
  access_token: string;
  refresh_token_value: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtAccessService: JwtAccessService,
    private readonly refreshTokenStore: InMemoryRefreshTokenStore
  ) {}

  async login(wid: string, deviceId = 'default-device'): Promise<AuthTokens> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7);
    const refreshTokenValue = this.jwtAccessService.issueOpaqueRefreshToken();

    await this.refreshTokenStore.withTransaction(async (tx) => {
      tx.insert({
        wid,
        device_id: deviceId,
        family_id: randomUUID(),
        jti: randomUUID(),
        parent_jti: null,
        refresh_token_hash: hashRefreshToken(refreshTokenValue),
        revoked: false,
        revoked_reason: null,
        expires_at: expiresAt,
        created_at: now
      });
    });

    return {
      access_token: this.jwtAccessService.issueAccessToken(wid),
      refresh_token_value: refreshTokenValue
    };
  }

  async refresh(
    wid: string,
    deviceId = 'default-device',
    refreshTokenValue: string
  ): Promise<AuthTokens> {
    const outcome = await this.refreshTokenStore.withTransaction<
      | { kind: 'rotated'; tokens: AuthTokens }
      | { kind: 'invalid' }
      | { kind: 'reuse_detected' }
    >(async (tx) => {
      const now = new Date();

      const tokenRecord = tx
        .listByWidDevice(wid, deviceId)
        .find((record) =>
          verifyRefreshTokenConstantTime(refreshTokenValue, record.refresh_token_hash)
        );

      if (!tokenRecord) {
        return { kind: 'invalid' };
      }

      if (tokenRecord.expires_at.getTime() <= now.getTime()) {
        tx.revokeByJti(tokenRecord.jti, 'expired');
        return { kind: 'invalid' };
      }

      if (tokenRecord.revoked) {
        tx.revokeFamily(wid, deviceId, tokenRecord.family_id, 'family_compromised');
        return { kind: 'reuse_detected' };
      }

      if (tx.isFamilyCompromised(wid, deviceId, tokenRecord.family_id)) {
        return { kind: 'invalid' };
      }

      tx.revokeByJti(tokenRecord.jti, 'rotated');

      const newRefreshTokenValue = this.jwtAccessService.issueOpaqueRefreshToken();
      const newRecord = {
        wid,
        device_id: deviceId,
        family_id: tokenRecord.family_id,
        jti: randomUUID(),
        parent_jti: tokenRecord.jti,
        refresh_token_hash: hashRefreshToken(newRefreshTokenValue),
        revoked: false,
        revoked_reason: null,
        expires_at: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7),
        created_at: now
      };

      tx.insert(newRecord);

      return {
        kind: 'rotated',
        tokens: {
          access_token: this.jwtAccessService.issueAccessToken(wid),
          refresh_token_value: newRefreshTokenValue
        }
      };
    });

    if (outcome.kind === 'rotated') {
      return outcome.tokens;
    }

    throw new UnauthorizedException('Invalid refresh token');
  }

  async logout(): Promise<void> {
    return;
  }

  async revokeDeviceSessions(wid: string, deviceId: string): Promise<void> {
    await this.refreshTokenStore.revokeDeviceFamilies(wid, deviceId);
  }
}
