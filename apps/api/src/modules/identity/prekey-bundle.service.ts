import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';

export interface SignedPrekeyInput {
  signed_prekey_id: number;
  signed_prekey_public: string;
  signature: string;
}

export interface OneTimePrekeyInput {
  prekey_id: number;
  public_key: string;
}

export interface PrekeyBundleUploadInput {
  wid: string;
  device_id: string;
  identity_key: string;
  signed_prekey: SignedPrekeyInput;
  one_time_prekeys: OneTimePrekeyInput[];
}

export interface PrekeyBundleFetchOutput {
  wid: string;
  device_id: string;
  identity_key: string;
  signed_prekey: SignedPrekeyInput;
  one_time_prekey: OneTimePrekeyInput;
}

interface DevicePrekeyState {
  wid: string;
  device_id: string;
  identity_key: string;
  signed_prekey: SignedPrekeyInput;
  one_time_prekeys: Array<OneTimePrekeyInput & { used: boolean }>;
  created_at: string;
}

@Injectable()
export class PrekeyBundleService {
  private readonly deviceState = new Map<string, DevicePrekeyState>();
  private readonly forbiddenFieldPattern = /(private|secret|shared|ratchet)/i;

  async uploadBundle(rawInput: unknown): Promise<void> {
    this.ensureNoForbiddenFieldNames(rawInput);
    const input = this.parseUploadInput(rawInput);
    const key = this.deviceKey(input.wid, input.device_id);

    if (this.deviceState.has(key)) {
      throw new ConflictException('prekey bundle for wid/device_id already exists');
    }

    const uniquePrekeyIds = new Set(input.one_time_prekeys.map((prekey) => prekey.prekey_id));
    if (uniquePrekeyIds.size !== input.one_time_prekeys.length) {
      throw new BadRequestException('duplicate prekey_id in one_time_prekeys');
    }

    this.deviceState.set(key, {
      wid: input.wid,
      device_id: input.device_id,
      identity_key: input.identity_key,
      signed_prekey: {
        signed_prekey_id: input.signed_prekey.signed_prekey_id,
        signed_prekey_public: input.signed_prekey.signed_prekey_public,
        signature: input.signed_prekey.signature
      },
      one_time_prekeys: input.one_time_prekeys.map((prekey) => ({
        prekey_id: prekey.prekey_id,
        public_key: prekey.public_key,
        used: false
      })),
      created_at: new Date().toISOString()
    });
  }

  async fetchBundleAndConsumeOneTimePrekey(
    wid: string,
    deviceId: string
  ): Promise<PrekeyBundleFetchOutput> {
    if (!wid || !deviceId) {
      throw new BadRequestException('wid and device_id are required');
    }

    const key = this.deviceKey(wid, deviceId);
    const state = this.deviceState.get(key);
    if (!state) {
      throw new BadRequestException('prekey bundle not found');
    }

    const nextPrekey = state.one_time_prekeys.find((prekey) => !prekey.used);
    if (!nextPrekey) {
      throw new ConflictException('prekey depleted');
    }

    // Atomic consume for in-memory store: mark used before returning.
    nextPrekey.used = true;

    return {
      wid: state.wid,
      device_id: state.device_id,
      identity_key: state.identity_key,
      signed_prekey: state.signed_prekey,
      one_time_prekey: {
        prekey_id: nextPrekey.prekey_id,
        public_key: nextPrekey.public_key
      }
    };
  }

  private parseUploadInput(rawInput: unknown): PrekeyBundleUploadInput {
    if (!rawInput || typeof rawInput !== 'object') {
      throw new BadRequestException('invalid bundle payload');
    }

    const input = rawInput as Record<string, unknown>;
    const wid = this.requireString(input.wid, 'wid');
    const deviceId = this.requireString(input.device_id, 'device_id');
    const identityKey = this.requireString(input.identity_key, 'identity_key');

    const signedPrekeyRaw = input.signed_prekey;
    if (!signedPrekeyRaw || typeof signedPrekeyRaw !== 'object') {
      throw new BadRequestException('signed_prekey is required');
    }
    const signedPrekey = signedPrekeyRaw as Record<string, unknown>;
    const signedPrekeyId = this.requireNumber(
      signedPrekey.signed_prekey_id,
      'signed_prekey.signed_prekey_id'
    );
    const signedPrekeyPublic = this.requireString(
      signedPrekey.signed_prekey_public,
      'signed_prekey.signed_prekey_public'
    );
    const signature = this.requireString(signedPrekey.signature, 'signed_prekey.signature');

    if (!Array.isArray(input.one_time_prekeys) || input.one_time_prekeys.length === 0) {
      throw new BadRequestException('one_time_prekeys must contain at least one prekey');
    }

    const oneTimePrekeys = input.one_time_prekeys.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new BadRequestException(`one_time_prekeys[${index}] invalid`);
      }
      const prekey = item as Record<string, unknown>;
      return {
        prekey_id: this.requireNumber(prekey.prekey_id, `one_time_prekeys[${index}].prekey_id`),
        public_key: this.requireString(prekey.public_key, `one_time_prekeys[${index}].public_key`)
      };
    });

    return {
      wid,
      device_id: deviceId,
      identity_key: identityKey,
      signed_prekey: {
        signed_prekey_id: signedPrekeyId,
        signed_prekey_public: signedPrekeyPublic,
        signature
      },
      one_time_prekeys: oneTimePrekeys
    };
  }

  private ensureNoForbiddenFieldNames(value: unknown): void {
    if (!value || typeof value !== 'object') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => this.ensureNoForbiddenFieldNames(entry));
      return;
    }

    const record = value as Record<string, unknown>;
    for (const [key, nested] of Object.entries(record)) {
      if (this.forbiddenFieldPattern.test(key)) {
        throw new BadRequestException(`forbidden field name: ${key}`);
      }
      this.ensureNoForbiddenFieldNames(nested);
    }
  }

  private requireString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${fieldName} must be a non-empty string`);
    }
    return value;
  }

  private requireNumber(value: unknown, fieldName: string): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      throw new BadRequestException(`${fieldName} must be a positive integer`);
    }
    return value;
  }

  private deviceKey(wid: string, deviceId: string): string {
    return `${wid}::${deviceId}`;
  }
}
