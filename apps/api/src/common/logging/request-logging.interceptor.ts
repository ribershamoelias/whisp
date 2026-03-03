import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SafeLogger } from './safe-logger.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: SafeLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      path: string;
      headers?: Record<string, string>;
      body?: Record<string, unknown>;
    }>();
    const started = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<{ statusCode: number }>();
        this.logger.info('http_request', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration_ms: Date.now() - started,
          headers: {
            authorization: req.headers?.authorization
          },
          body: req.body
        });
      })
    );
  }
}
