import { Global, Module } from '@nestjs/common';
import { BlockRegistryService } from './state/block-registry.service';
import { LOG_SINK, SafeLogger, StdoutLogSink } from './logging/safe-logger.service';

@Global()
@Module({
  providers: [
    BlockRegistryService,
    SafeLogger,
    {
      provide: LOG_SINK,
      useClass: StdoutLogSink
    }
  ],
  exports: [BlockRegistryService, SafeLogger, LOG_SINK]
})
export class CommonModule {}
