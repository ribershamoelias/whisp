import { Injectable } from '@nestjs/common';

export interface AuthTokens {
  access_token: string;
  refresh_token_value: string;
}

@Injectable()
export class AuthService {
  async login(_wid: string): Promise<AuthTokens> {
    return {
      access_token: 'scaffold-access-token',
      refresh_token_value: 'scaffold-refresh-token'
    };
  }

  async refresh(_refreshTokenValue: string): Promise<AuthTokens> {
    return {
      access_token: 'rotated-access-token',
      refresh_token_value: 'rotated-refresh-token'
    };
  }

  async logout(): Promise<void> {
    return;
  }
}
