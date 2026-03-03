import { Injectable } from '@nestjs/common';

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

@Injectable()
export class RelayService {
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
}
