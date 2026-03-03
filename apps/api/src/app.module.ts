import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { IdentityModule } from './modules/identity/identity.module';
import { SpacesModule } from './modules/spaces/spaces.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { RelayModule } from './modules/relay/relay.module';
import { CommonModule } from './common/common.module';
import { PolicyGuard } from './common/authz/policy.guard';
import { RequestLoggingInterceptor } from './common/logging/request-logging.interceptor';

@Module({
  imports: [CommonModule, AuthModule, IdentityModule, SpacesModule, PermissionsModule, RelayModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: PolicyGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor
    }
  ]
})
export class AppModule {}
