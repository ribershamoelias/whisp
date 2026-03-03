import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { PrekeyBundleService } from './prekey-bundle.service';

@Module({
  imports: [AuthModule],
  controllers: [IdentityController],
  providers: [IdentityService, PrekeyBundleService],
  exports: [IdentityService, PrekeyBundleService]
})
export class IdentityModule {}
