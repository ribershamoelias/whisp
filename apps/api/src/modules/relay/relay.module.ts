import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { RelayController } from './relay.controller';
import { RelayService } from './relay.service';

@Module({
  imports: [IdentityModule],
  controllers: [RelayController],
  providers: [RelayService],
  exports: [RelayService]
})
export class RelayModule {}
