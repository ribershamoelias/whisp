import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { RequiresPolicy } from '../../common/authz/requires-policy.decorator';
import {
  DeviceRegistration,
  IdentityService,
  PublicKeyBundle,
  RegisterIdentityInput
} from './identity.service';

@Controller('identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('register')
  @RequiresPolicy('IDENTITY_REGISTER', { actor: 'wid' })
  register(@Body() body: RegisterIdentityInput): Promise<void> {
    return this.identityService.register(body);
  }

  @Post('devices')
  @RequiresPolicy('IDENTITY_REGISTER_DEVICE', { actor: 'wid' })
  registerDevice(@Body() body: DeviceRegistration): Promise<void> {
    return this.identityService.registerDevice(body);
  }

  @Get('key-bundles/:wid')
  getKeyBundle(@Param('wid') wid: string): Promise<PublicKeyBundle> {
    return this.identityService.getPublicKeyBundle(wid);
  }

  @Post('blocks/:target_wid')
  @RequiresPolicy('IDENTITY_BLOCK_ADD', { target: 'target_wid' })
  block(@Param('target_wid') targetWid: string): Promise<void> {
    return this.identityService.block(targetWid);
  }

  @Delete('blocks/:target_wid')
  @RequiresPolicy('IDENTITY_BLOCK_REMOVE', { target: 'target_wid' })
  unblock(@Param('target_wid') targetWid: string): Promise<void> {
    return this.identityService.unblock(targetWid);
  }
}
