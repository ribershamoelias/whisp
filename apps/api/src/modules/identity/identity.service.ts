import { Injectable } from '@nestjs/common';
import { BlockRegistryService } from '../../common/state/block-registry.service';
import { AuthService } from '../auth/auth.service';

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
  private readonly devicesByWid = new Map<string, Map<string, string>>();

  constructor(
    private readonly blockRegistry: BlockRegistryService,
    private readonly authService: AuthService
  ) {}

  async register(_input: RegisterIdentityInput): Promise<void> {
    return;
  }

  async registerDevice(_input: DeviceRegistration): Promise<void> {
    const devices = this.devicesByWid.get(_input.wid) ?? new Map<string, string>();
    devices.set(_input.device_id, _input.device_public_key);
    this.devicesByWid.set(_input.wid, devices);
    return;
  }

  async getPublicKeyBundle(wid: string): Promise<PublicKeyBundle> {
    const devices = this.devicesByWid.get(wid) ?? new Map<string, string>();
    return {
      wid,
      public_key: 'public-key-placeholder',
      devices: Array.from(devices.entries()).map(([device_id, device_public_key]) => ({
        device_id,
        device_public_key
      }))
    };
  }

  async block(actorWid: string, targetWid: string): Promise<void> {
    this.blockRegistry.addBlock(actorWid, targetWid);
    return;
  }

  async unblock(actorWid: string, targetWid: string): Promise<void> {
    this.blockRegistry.removeBlock(actorWid, targetWid);
    return;
  }

  async revokeDevice(wid: string, deviceId: string): Promise<void> {
    const devices = this.devicesByWid.get(wid);
    devices?.delete(deviceId);
    await this.authService.revokeDeviceSessions(wid, deviceId);
  }
}
