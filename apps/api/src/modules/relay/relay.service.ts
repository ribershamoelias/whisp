import {
  BadRequestException,
  ConflictException,
  Injectable,
  PayloadTooLargeException
} from '@nestjs/common';

export interface RelayMessageInput {
  space_id: string;
  sender_wid: string;
  to_wid: string;
  ciphertext_blob: string;
  client_message_id?: string;
}

export interface RelayMessageOutput {
  message_id: string;
  space_id: string;
  sender_wid: string;
  ciphertext_blob: string;
  created_at: string;
}

export interface RelayEchoInput {
  wid: string;
  device_id: string;
  message_id: string;
  ciphertext: string;
}

export interface RelayEchoOutput {
  wid: string;
  device_id: string;
  message_id: string;
  ciphertext: string;
  created_at: string;
}

const MAX_ECHO_PAYLOAD_BYTES = 65536;

@Injectable()
export class RelayService {
  private readonly echoStore = new Map<
    string,
    { wid: string; device_id: string; message_id: string; ciphertext_blob: Buffer; created_at: string }
  >();

  async enqueue(_input: RelayMessageInput): Promise<{ message_id: string }> {
    return { message_id: 'scaffold-message-id' };
  }

  async listBySpace(spaceId: string): Promise<RelayMessageOutput[]> {
    return [
      {
        message_id: 'scaffold-message-id',
        space_id: spaceId,
        sender_wid: 'scaffold-wid',
        ciphertext_blob: 'ciphertext-placeholder',
        created_at: new Date().toISOString()
      }
    ];
  }

  async submitEcho(input: RelayEchoInput): Promise<RelayEchoOutput> {
    const wid = this.requireField(input.wid, 'wid');
    const deviceId = this.requireField(input.device_id, 'device_id');
    const messageId = this.requireField(input.message_id, 'message_id');
    const ciphertext = this.requireField(input.ciphertext, 'ciphertext');

    const ciphertextBlob = this.decodeBase64Ciphertext(ciphertext);
    if (ciphertextBlob.length > MAX_ECHO_PAYLOAD_BYTES) {
      throw new PayloadTooLargeException('ciphertext exceeds 65536 bytes');
    }

    const key = this.echoKey(wid, deviceId, messageId);
    if (this.echoStore.has(key)) {
      throw new ConflictException('duplicate message_id for wid/device_id');
    }

    const createdAt = new Date().toISOString();
    this.echoStore.set(key, {
      wid,
      device_id: deviceId,
      message_id: messageId,
      ciphertext_blob: ciphertextBlob,
      created_at: createdAt
    });

    return {
      wid,
      device_id: deviceId,
      message_id: messageId,
      ciphertext: ciphertextBlob.toString('base64'),
      created_at: createdAt
    };
  }

  async getEcho(wid: string, deviceId: string, messageId: string): Promise<RelayEchoOutput> {
    const key = this.echoKey(wid, deviceId, messageId);
    const row = this.echoStore.get(key);
    if (!row) {
      throw new BadRequestException('echo message not found');
    }

    return {
      wid: row.wid,
      device_id: row.device_id,
      message_id: row.message_id,
      ciphertext: row.ciphertext_blob.toString('base64'),
      created_at: row.created_at
    };
  }

  private requireField(value: string | undefined, fieldName: string): string {
    if (!value || !value.trim()) {
      throw new BadRequestException(`missing required field: ${fieldName}`);
    }
    return value;
  }

  private decodeBase64Ciphertext(value: string): Buffer {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length === 0) {
      throw new BadRequestException('ciphertext must not be empty');
    }
    if (decoded.toString('base64') !== value) {
      throw new BadRequestException('ciphertext must be canonical base64');
    }
    return decoded;
  }

  private echoKey(wid: string, deviceId: string, messageId: string): string {
    return `${wid}::${deviceId}::${messageId}`;
  }
}
