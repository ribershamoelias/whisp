import { Inject, Injectable } from '@nestjs/common';

export const LOG_SINK = 'LOG_SINK';

export interface LogSink {
  write(line: string): void;
}

export class StdoutLogSink implements LogSink {
  write(line: string): void {
    process.stdout.write(`${line}\n`);
  }
}

@Injectable()
export class SafeLogger {
  private readonly blockedKeys = new Set([
    'authorization',
    'access_token',
    'refresh_token_value',
    'ciphertext',
    'ciphertext_blob',
    'private_key',
    'identity_key',
    'prekey',
    'device_public_key'
  ]);

  constructor(@Inject(LOG_SINK) private readonly sink: LogSink) {}

  info(event: string, payload: unknown): void {
    this.write('info', event, payload);
  }

  warn(event: string, payload: unknown): void {
    this.write('warn', event, payload);
  }

  error(event: string, payload: unknown): void {
    this.write('error', event, payload);
  }

  sanitize(payload: unknown): unknown {
    if (payload === null || payload === undefined) {
      return payload;
    }

    if (typeof payload === 'string') {
      return this.sanitizeString(payload);
    }

    if (Array.isArray(payload)) {
      return payload.map((item) => this.sanitize(item));
    }

    if (typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      const out: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(record)) {
        const normalized = key.toLowerCase();
        if (this.blockedKeys.has(normalized)) {
          out[key] = this.placeholderFor(normalized);
          continue;
        }
        out[key] = this.sanitize(value);
      }
      return out;
    }

    return payload;
  }

  private write(level: 'info' | 'warn' | 'error', event: string, payload: unknown): void {
    const entry = {
      ts: new Date().toISOString(),
      level,
      event,
      payload: this.sanitize(payload)
    };
    this.sink.write(JSON.stringify(entry));
  }

  private sanitizeString(value: string): string {
    if (/bearer\s+[A-Za-z0-9\-_.]+/i.test(value)) {
      return 'Bearer [REDACTED]';
    }
    if (/access[_-]?token/i.test(value)) {
      return '[REDACTED]';
    }
    if (/refresh[_-]?token/i.test(value)) {
      return '[REDACTED]';
    }
    if (/ciphertext/i.test(value)) {
      return '[REDACTED_CIPHERTEXT]';
    }
    return value;
  }

  private placeholderFor(key: string): string {
    if (key === 'ciphertext_blob') {
      return '[REDACTED_CIPHERTEXT]';
    }
    if (key === 'authorization') {
      return 'Bearer [REDACTED]';
    }
    return '[REDACTED]';
  }
}
