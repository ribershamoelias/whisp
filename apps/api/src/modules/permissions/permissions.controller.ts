import { Body, Controller, Post } from '@nestjs/common';
import { PermissionDecision } from '../../common/types';
import {
  DmEligibilityInput,
  PermissionsService,
  SpaceActionInput
} from './permissions.service';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post('dm-eligibility')
  dmEligibility(@Body() body: DmEligibilityInput): Promise<PermissionDecision> {
    return this.permissionsService.checkDmEligibility(body);
  }

  @Post('space-action')
  spaceAction(@Body() body: SpaceActionInput): Promise<PermissionDecision> {
    return this.permissionsService.checkSpaceAction(body);
  }
}
