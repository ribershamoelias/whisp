import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { RequiresPolicy } from '../../common/authz/requires-policy.decorator';
import {
  DeviceRegistration,
  IdentityService,
  PublicKeyBundle,
  RegisterIdentityInput
} from './identity.service';
import { PrekeyBundleFetchOutput, PrekeyBundleService } from './prekey-bundle.service';

@Controller('identity')
export class IdentityController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly prekeyBundleService: PrekeyBundleService
  ) {}

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

  @Delete('devices/:device_id')
  @HttpCode(204)
  @RequiresPolicy('IDENTITY_DEVICE_REVOKE', { actor: 'wid' })
  revokeDevice(
    @Param('device_id') deviceId: string,
    @Body() body: { wid: string }
  ): Promise<void> {
    return this.identityService.revokeDevice(body.wid, deviceId);
  }

  @Get('key-bundles/:wid')
  getKeyBundle(@Param('wid') wid: string): Promise<PublicKeyBundle> {
    return this.identityService.getPublicKeyBundle(wid);
  }

  @Post('blocks/:target_wid')
  @HttpCode(204)
  @RequiresPolicy('IDENTITY_BLOCK_ADD', { actor: 'wid', target: 'target_wid' })
  block(@Param('target_wid') targetWid: string, @Body() body: { wid: string }): Promise<void> {
    return this.identityService.block(body.wid, targetWid);
  }

  @Delete('blocks/:target_wid')
  @HttpCode(204)
  @RequiresPolicy('IDENTITY_BLOCK_REMOVE', { actor: 'wid', target: 'target_wid' })
  unblock(@Param('target_wid') targetWid: string, @Body() body: { wid: string }): Promise<void> {
    return this.identityService.unblock(body.wid, targetWid);
  }

  @Post('prekey-bundle')
  @RequiresPolicy('IDENTITY_PREKEY_UPLOAD', { actor: 'wid' })
  uploadPrekeyBundle(@Body() body: unknown): Promise<void> {
    return this.prekeyBundleService.uploadBundle(body);
  }

  @Get('prekey-bundle/:wid/:device_id')
  fetchPrekeyBundle(
    @Param('wid') wid: string,
    @Param('device_id') deviceId: string
  ): Promise<PrekeyBundleFetchOutput> {
    return this.prekeyBundleService.fetchBundleAndConsumeOneTimePrekey(wid, deviceId);
  }
}
