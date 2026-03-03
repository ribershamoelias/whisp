import { Injectable } from '@nestjs/common';

export interface CreateSpaceInput {
  type: 'private' | 'school' | 'public';
  public_flag: boolean;
}

export interface UpdateRoleInput {
  wid: string;
  role: 'member' | 'moderator' | 'admin';
}

export interface SpaceAcceptResponse {
  space_id: string;
}

@Injectable()
export class SpacesService {
  async createSpace(_input: CreateSpaceInput): Promise<{ space_id: string }> {
    return { space_id: 'scaffold-space-id' };
  }

  async join(_spaceId: string): Promise<void> {
    return;
  }

  async leave(_spaceId: string): Promise<void> {
    return;
  }

  async assignRole(_spaceId: string, _input: UpdateRoleInput): Promise<void> {
    return;
  }

  async createRequest(_toWid: string): Promise<{ request_id: string }> {
    return { request_id: 'scaffold-request-id' };
  }

  async acceptRequest(_requestId: string): Promise<SpaceAcceptResponse> {
    return { space_id: 'scaffold-private-space-id' };
  }

  async rejectRequest(_requestId: string): Promise<void> {
    return;
  }
}
