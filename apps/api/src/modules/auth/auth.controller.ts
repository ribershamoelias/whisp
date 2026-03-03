import { Body, Controller, Post } from '@nestjs/common';
import { AuthService, AuthTokens } from './auth.service';
import { RequiresPolicy } from '../../common/authz/requires-policy.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @RequiresPolicy('AUTH_LOGIN', { actor: 'wid' })
  login(@Body() body: { wid: string; device_id?: string }): Promise<AuthTokens> {
    return this.authService.login(body.wid, body.device_id);
  }

  @Post('refresh')
  @RequiresPolicy('AUTH_REFRESH', { actor: 'wid' })
  refresh(
    @Body() body: { wid: string; device_id?: string; refresh_token_value: string }
  ): Promise<AuthTokens> {
    return this.authService.refresh(body.wid, body.device_id, body.refresh_token_value);
  }

  @Post('logout')
  @RequiresPolicy('AUTH_LOGOUT', { actor: 'wid' })
  logout(@Body() body: { wid: string }): Promise<void> {
    void body;
    return this.authService.logout();
  }
}
