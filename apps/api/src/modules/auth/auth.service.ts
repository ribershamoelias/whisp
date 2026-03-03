import { Injectable } from '@nestjs/common';
import { JwtAccessService } from '../../common/auth/jwt-access.service';

export interface AuthTokens {
  access_token: string;
  refresh_token_value: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtAccessService: JwtAccessService) {}

  async login(wid: string): Promise<AuthTokens> {
    return {
      access_token: this.jwtAccessService.issueAccessToken(wid),
      refresh_token_value: this.jwtAccessService.issueOpaqueRefreshToken()
    };
  }

  async refresh(wid: string, _refreshTokenValue: string): Promise<AuthTokens> {
    return {
      access_token: this.jwtAccessService.issueAccessToken(wid),
      refresh_token_value: this.jwtAccessService.issueOpaqueRefreshToken()
    };
  }

  async logout(): Promise<void> {
    return;
  }
}
