import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InMemoryRefreshTokenStore } from './refresh-token.store';

@Module({
  controllers: [AuthController],
  providers: [AuthService, InMemoryRefreshTokenStore],
  exports: [AuthService, InMemoryRefreshTokenStore]
})
export class AuthModule {}
