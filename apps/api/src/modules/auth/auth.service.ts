import { Injectable } from '@nestjs/common';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class AuthService {
  async login(_wid: string): Promise<AuthTokens> {
    return {
      access_token: 'scaffold-access-token',
      refresh_token: 'scaffold-refresh-token'
    };
  }

  async refresh(_refreshToken: string): Promise<AuthTokens> {
    return {
      access_token: 'rotated-access-token',
      refresh_token: 'rotated-refresh-token'
    };
  }

  async logout(): Promise<void> {
    return;
  }
}
