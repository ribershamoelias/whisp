import { Injectable } from '@nestjs/common';
import { BlockRegistryService } from '../../common/state/block-registry.service';

export interface RegisterIdentityInput {
  wid: string;
  public_key: string;
}

export interface DeviceRegistration {
  wid: string;
  device_id: string;
  device_public_key: string;
}

export interface PublicKeyBundle {
  wid: string;
  public_key: string;
  devices: Array<{ device_id: string; device_public_key: string }>;
}

@Injectable()
export class IdentityService {
  private currentWid = 'scaffold-wid';

  constructor(private readonly blockRegistry: BlockRegistryService) {}

  async register(_input: RegisterIdentityInput): Promise<void> {
    this.currentWid = _input.wid;
    return;
  }

  async registerDevice(_input: DeviceRegistration): Promise<void> {
    return;
  }

  async getPublicKeyBundle(wid: string): Promise<PublicKeyBundle> {
    return {
      wid,
      public_key: 'public-key-placeholder',
      devices: []
    };
  }

  async block(_targetWid: string): Promise<void> {
    this.blockRegistry.addBlock(this.currentWid, _targetWid);
    return;
  }

  async unblock(_targetWid: string): Promise<void> {
    this.blockRegistry.removeBlock(this.currentWid, _targetWid);
    return;
  }
}
