import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { sign, verify, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

interface AccessTokenPayload {
  sub: string;
  typ: 'access';
}

interface VerifiedAccessToken extends AccessTokenPayload {
  iat: number;
  exp: number;
}

@Injectable()
export class JwtAccessService {
  private readonly secret: string;
  private readonly accessTtlSeconds: number;

  constructor() {
    this.secret = process.env.ACCESS_TOKEN_SECRET ?? 'dev-access-secret-change-me';
    const parsedTtl = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? '300');
    this.accessTtlSeconds = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 300;
  }

  issueAccessToken(wid: string): string {
    const payload: AccessTokenPayload = {
      sub: wid,
      typ: 'access'
    };

    return sign(payload, this.secret, {
      algorithm: 'HS256',
      expiresIn: this.accessTtlSeconds,
      noTimestamp: false
    });
  }

  issueOpaqueRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  verifyAccessToken(token: string): VerifiedAccessToken {
    try {
      const decoded = verify(token, this.secret, {
        algorithms: ['HS256'],
        clockTolerance: 0
      });

      if (typeof decoded !== 'object' || !decoded || decoded.typ !== 'access' || !decoded.sub) {
        throw new UnauthorizedException('Invalid access token payload');
      }

      return decoded as VerifiedAccessToken;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException('Access token expired');
      }
      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedException('Invalid access token signature');
      }
      throw error;
    }
  }

  extractBearerToken(authorizationHeader: string): string {
    const [scheme, token] = authorizationHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Malformed authorization header');
    }
    return token;
  }
}
