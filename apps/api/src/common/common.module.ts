import { Global, Module } from '@nestjs/common';
import { BlockRegistryService } from './state/block-registry.service';
import { LOG_SINK, SafeLogger, StdoutLogSink } from './logging/safe-logger.service';
import { JwtAccessService } from './auth/jwt-access.service';

@Global()
@Module({
  providers: [
    BlockRegistryService,
    SafeLogger,
    JwtAccessService,
    {
      provide: LOG_SINK,
      useClass: StdoutLogSink
    }
  ],
  exports: [BlockRegistryService, SafeLogger, JwtAccessService, LOG_SINK]
})
export class CommonModule {}
