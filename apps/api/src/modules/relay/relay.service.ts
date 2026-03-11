import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  PayloadTooLargeException
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IdentityService } from '../identity/identity.service';

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

export interface ConversationCreateInput {
  initiator_wid: string;
  target_wid: string;
}

export interface ConversationOutput {
  conversation_id: string;
  type: '1to1';
  participants: [string, string];
  created_at: string;
}

export interface MessageMetadataInput {
  conversation_id: string;
  sender_wid: string;
  sender_device_id: string;
  client_message_id: string;
  seq?: never;
}

export interface MessageMetadataOutput {
  conversation_id: string;
  seq: number;
  sender_wid: string;
  sender_device_id: string;
  client_message_id: string;
  created_at: string;
  idempotent_replay: boolean;
}

export interface CiphertextMessageSendInput {
  conversation_id: string;
  sender_wid: string;
  sender_device_id: string;
  client_message_id: string;
  ciphertext: string;
  seq?: never;
}

export interface CiphertextMessageSendOutput {
  conversation_id: string;
  seq: number;
  sender_wid: string;
  sender_device_id: string;
  client_message_id: string;
  created_at: string;
}

export interface DeliveryStateUpdateInput {
  conversation_id: string;
  seq: number;
  target_wid: string;
  target_device_id: string;
}

export interface DeliveryStateRow {
  conversation_id: string;
  seq: number;
  target_wid: string;
  target_device_id: string;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

const MAX_ECHO_PAYLOAD_BYTES = 65536;
const MAX_MESSAGE_CIPHERTEXT_BYTES = 65536;

@Injectable()
export class RelayService {
  constructor(@Optional() private readonly identityService?: IdentityService) {}

  private readonly conversations = new Map<
    string,
    {
      conversation_id: string;
      type: '1to1';
      participants: [string, string];
      created_at: string;
      next_seq: number;
    }
  >();
  private readonly conversationByPair = new Map<string, string>();
  private readonly metadataStore = new Map<string, MessageMetadataOutput>();
  private readonly idempotencyStore = new Map<string, MessageMetadataOutput>();
  private readonly ciphertextMessagesBySequence = new Map<
    string,
    CiphertextMessageSendOutput & { ciphertext_blob: Buffer }
  >();
  private readonly ciphertextMessageStore = new Map<
    string,
    CiphertextMessageSendOutput & { ciphertext_blob: Buffer }
  >();
  private readonly deliveryStateStore = new Map<string, DeliveryStateRow>();
  private readonly echoStore = new Map<
    string,
    { wid: string; device_id: string; message_id: string; ciphertext_blob: Buffer; created_at: string }
  >();

  async enqueue(_input: RelayMessageInput): Promise<{ message_id: string }> {
    return { message_id: 'scaffold-message-id' };
  }

  async createConversation(input: ConversationCreateInput): Promise<ConversationOutput> {
    const initiator = this.requireField(input.initiator_wid, 'initiator_wid');
    const target = this.requireField(input.target_wid, 'target_wid');
    if (initiator === target) {
      throw new BadRequestException('initiator_wid and target_wid must differ');
    }

    const pairKey = this.conversationPairKey(initiator, target);
    const existingId = this.conversationByPair.get(pairKey);
    if (existingId) {
      const existing = this.conversations.get(existingId);
      if (!existing) {
        throw new ConflictException('conversation index corrupted');
      }
      return {
        conversation_id: existing.conversation_id,
        type: existing.type,
        participants: existing.participants,
        created_at: existing.created_at
      };
    }

    const conversationId = randomUUID();
    const participants = [initiator, target].sort() as [string, string];
    const createdAt = new Date().toISOString();
    this.conversations.set(conversationId, {
      conversation_id: conversationId,
      type: '1to1',
      participants,
      created_at: createdAt,
      next_seq: 1
    });
    this.conversationByPair.set(pairKey, conversationId);

    return {
      conversation_id: conversationId,
      type: '1to1',
      participants,
      created_at: createdAt
    };
  }

  async storeMessageMetadata(input: unknown): Promise<MessageMetadataOutput> {
    const parsed = this.parseMetadataInput(input);
    const conversation = this.conversations.get(parsed.conversation_id);
    if (!conversation) {
      throw new BadRequestException('conversation not found');
    }
    if (!conversation.participants.includes(parsed.sender_wid)) {
      throw new BadRequestException('sender_wid is not a participant of the conversation');
    }

    const idemKey = this.idempotencyKey(parsed.sender_device_id, parsed.client_message_id);
    const existing = this.idempotencyStore.get(idemKey);
    if (existing) {
      if (
        existing.conversation_id !== parsed.conversation_id ||
        existing.sender_wid !== parsed.sender_wid
      ) {
        throw new ConflictException('client_message_id already used for sender_device_id');
      }
      return {
        ...existing,
        idempotent_replay: true
      };
    }

    const seq = conversation.next_seq;
    conversation.next_seq += 1;

    const metadata: MessageMetadataOutput = {
      conversation_id: parsed.conversation_id,
      seq,
      sender_wid: parsed.sender_wid,
      sender_device_id: parsed.sender_device_id,
      client_message_id: parsed.client_message_id,
      created_at: new Date().toISOString(),
      idempotent_replay: false
    };

    this.metadataStore.set(this.messageKey(parsed.conversation_id, seq), metadata);
    this.idempotencyStore.set(idemKey, metadata);
    return metadata;
  }

  async sendCiphertextMessage(input: unknown): Promise<CiphertextMessageSendOutput> {
    const parsed = this.parseCiphertextMessageInput(input);
    const conversation = this.conversations.get(parsed.conversation_id);
    if (!conversation) {
      throw new BadRequestException('conversation not found');
    }
    if (!conversation.participants.includes(parsed.sender_wid)) {
      throw new BadRequestException('sender_wid is not a participant of the conversation');
    }

    const ciphertextBlob = this.decodeBase64Ciphertext(parsed.ciphertext);
    if (ciphertextBlob.length > MAX_MESSAGE_CIPHERTEXT_BYTES) {
      throw new PayloadTooLargeException('ciphertext exceeds 65536 bytes');
    }

    const idemKey = this.idempotencyKey(parsed.sender_device_id, parsed.client_message_id);
    const existing = this.ciphertextMessageStore.get(idemKey);
    if (existing) {
      if (
        existing.conversation_id !== parsed.conversation_id ||
        existing.sender_wid !== parsed.sender_wid ||
        existing.ciphertext_blob.equals(ciphertextBlob) === false
      ) {
        throw new ConflictException('client_message_id already used for sender_device_id');
      }
      return {
        conversation_id: existing.conversation_id,
        seq: existing.seq,
        sender_wid: existing.sender_wid,
        sender_device_id: existing.sender_device_id,
        client_message_id: existing.client_message_id,
        created_at: existing.created_at
      };
    }

    const seq = conversation.next_seq;
    conversation.next_seq += 1;
    const stored: CiphertextMessageSendOutput & { ciphertext_blob: Buffer } = {
      conversation_id: parsed.conversation_id,
      seq,
      sender_wid: parsed.sender_wid,
      sender_device_id: parsed.sender_device_id,
      client_message_id: parsed.client_message_id,
      created_at: new Date().toISOString(),
      ciphertext_blob: ciphertextBlob
    };

    this.ciphertextMessageStore.set(idemKey, stored);
    this.ciphertextMessagesBySequence.set(this.messageKey(parsed.conversation_id, seq), stored);
    await this.createDeliveryRows(conversation, stored);
    return {
      conversation_id: stored.conversation_id,
      seq: stored.seq,
      sender_wid: stored.sender_wid,
      sender_device_id: stored.sender_device_id,
      client_message_id: stored.client_message_id,
      created_at: stored.created_at
    };
  }

  async markDelivered(input: unknown): Promise<void> {
    const parsed = this.parseDeliveryStateUpdateInput(input);
    const message = this.ciphertextMessagesBySequence.get(
      this.messageKey(parsed.conversation_id, parsed.seq)
    );
    if (!message) {
      throw new NotFoundException('message not found');
    }
    const delivery = this.deliveryStateStore.get(
      this.deliveryKey(parsed.conversation_id, parsed.seq, parsed.target_device_id)
    );
    if (!delivery || delivery.target_wid !== parsed.target_wid) {
      throw new NotFoundException('delivery row not found');
    }

    if (delivery.delivered_at) {
      return;
    }

    delivery.delivered_at = new Date().toISOString();
  }

  async markRead(input: unknown): Promise<void> {
    const parsed = this.parseDeliveryStateUpdateInput(input);
    const message = this.ciphertextMessagesBySequence.get(
      this.messageKey(parsed.conversation_id, parsed.seq)
    );
    if (!message) {
      throw new NotFoundException('message not found');
    }
    const delivery = this.deliveryStateStore.get(
      this.deliveryKey(parsed.conversation_id, parsed.seq, parsed.target_device_id)
    );
    if (!delivery || delivery.target_wid !== parsed.target_wid) {
      throw new NotFoundException('delivery row not found');
    }

    if (!delivery.delivered_at) {
      throw new ConflictException('message must be delivered before read');
    }

    if (delivery.read_at) {
      return;
    }

    delivery.read_at = new Date().toISOString();
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

  private parseMetadataInput(rawInput: unknown): MessageMetadataInput {
    if (!rawInput || typeof rawInput !== 'object') {
      throw new BadRequestException('invalid metadata payload');
    }
    const input = rawInput as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(input, 'seq')) {
      throw new BadRequestException('seq must not be provided by client');
    }

    return {
      conversation_id: this.requireField(input.conversation_id as string, 'conversation_id'),
      sender_wid: this.requireField(input.sender_wid as string, 'sender_wid'),
      sender_device_id: this.requireField(input.sender_device_id as string, 'sender_device_id'),
      client_message_id: this.requireField(input.client_message_id as string, 'client_message_id')
    };
  }

  private parseCiphertextMessageInput(rawInput: unknown): CiphertextMessageSendInput {
    if (!rawInput || typeof rawInput !== 'object') {
      throw new BadRequestException('invalid ciphertext message payload');
    }
    const input = rawInput as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(input, 'seq')) {
      throw new BadRequestException('seq must not be provided by client');
    }

    return {
      conversation_id: this.requireField(input.conversation_id as string, 'conversation_id'),
      sender_wid: this.requireField(input.sender_wid as string, 'sender_wid'),
      sender_device_id: this.requireField(input.sender_device_id as string, 'sender_device_id'),
      client_message_id: this.requireField(input.client_message_id as string, 'client_message_id'),
      ciphertext: this.requireField(input.ciphertext as string, 'ciphertext')
    };
  }

  private parseDeliveryStateUpdateInput(rawInput: unknown): DeliveryStateUpdateInput {
    if (!rawInput || typeof rawInput !== 'object') {
      throw new BadRequestException('invalid delivery state payload');
    }
    const input = rawInput as Record<string, unknown>;
    this.assertAllowedFields(input, ['conversation_id', 'seq', 'target_wid', 'target_device_id']);

    const seq = input.seq;
    if (typeof seq !== 'number' || !Number.isInteger(seq) || seq <= 0) {
      throw new BadRequestException('seq must be a positive integer');
    }

    return {
      conversation_id: this.requireUuid(input.conversation_id as string, 'conversation_id'),
      seq,
      target_wid: this.requireField(input.target_wid as string, 'target_wid'),
      target_device_id: this.requireField(input.target_device_id as string, 'target_device_id')
    };
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

  private async createDeliveryRows(
    conversation: {
      conversation_id: string;
      type: '1to1';
      participants: [string, string];
      created_at: string;
      next_seq: number;
    },
    stored: CiphertextMessageSendOutput & { ciphertext_blob: Buffer }
  ): Promise<void> {
    const targetWid = conversation.participants.find((wid) => wid !== stored.sender_wid);
    if (!targetWid) {
      throw new ConflictException('conversation target resolution failed');
    }

    const targetDeviceIds = (await this.identityService?.listDeviceIds(targetWid)) ?? [];
    for (const targetDeviceId of targetDeviceIds) {
      const key = this.deliveryKey(stored.conversation_id, stored.seq, targetDeviceId);
      if (this.deliveryStateStore.has(key)) {
        continue;
      }

      this.deliveryStateStore.set(key, {
        conversation_id: stored.conversation_id,
        seq: stored.seq,
        target_wid: targetWid,
        target_device_id: targetDeviceId,
        delivered_at: null,
        read_at: null,
        created_at: stored.created_at
      });
    }
  }

  private requireUuid(value: string | undefined, fieldName: string): string {
    const parsed = this.requireField(value, fieldName);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed)) {
      throw new BadRequestException(`${fieldName} must be a valid uuid`);
    }
    return parsed;
  }

  private assertAllowedFields(input: Record<string, unknown>, allowedFields: string[]): void {
    for (const key of Object.keys(input)) {
      if (!allowedFields.includes(key)) {
        throw new BadRequestException(`unexpected field: ${key}`);
      }
    }
  }

  private echoKey(wid: string, deviceId: string, messageId: string): string {
    return `${wid}::${deviceId}::${messageId}`;
  }

  private conversationPairKey(leftWid: string, rightWid: string): string {
    return [leftWid, rightWid].sort().join('::');
  }

  private idempotencyKey(senderDeviceId: string, clientMessageId: string): string {
    return `${senderDeviceId}::${clientMessageId}`;
  }

  private messageKey(conversationId: string, seq: number): string {
    return `${conversationId}::${seq}`;
  }

  private deliveryKey(conversationId: string, seq: number, targetDeviceId: string): string {
    return `${conversationId}::${seq}::${targetDeviceId}`;
  }
}
