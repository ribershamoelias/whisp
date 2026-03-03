import { Body, Controller, Param, Post } from '@nestjs/common';
import { RequiresPolicy } from '../../common/authz/requires-policy.decorator';
import {
  CreateSpaceInput,
  SpaceAcceptResponse,
  SpacesService,
  UpdateRoleInput
} from './spaces.service';

@Controller('spaces')
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Post()
  @RequiresPolicy('SPACE_CREATE')
  createSpace(@Body() body: CreateSpaceInput): Promise<{ space_id: string }> {
    return this.spacesService.createSpace(body);
  }

  @Post(':space_id/join')
  @RequiresPolicy('SPACE_JOIN', { space: 'space_id' })
  join(@Param('space_id') spaceId: string): Promise<void> {
    return this.spacesService.join(spaceId);
  }

  @Post(':space_id/leave')
  @RequiresPolicy('SPACE_LEAVE', { space: 'space_id' })
  leave(@Param('space_id') spaceId: string): Promise<void> {
    return this.spacesService.leave(spaceId);
  }

  @Post(':space_id/roles')
  @RequiresPolicy('SPACE_ROLE_ASSIGN', { space: 'space_id', target: 'wid' })
  assignRole(@Param('space_id') spaceId: string, @Body() body: UpdateRoleInput): Promise<void> {
    return this.spacesService.assignRole(spaceId, body);
  }

  @Post('requests')
  @RequiresPolicy('REQUEST_CREATE', { to: 'to_wid' })
  createRequest(@Body() body: { to_wid: string }): Promise<{ request_id: string }> {
    return this.spacesService.createRequest(body.to_wid);
  }

  @Post('requests/:request_id/accept')
  @RequiresPolicy('REQUEST_ACCEPT', { request: 'request_id' })
  accept(@Param('request_id') requestId: string): Promise<SpaceAcceptResponse> {
    return this.spacesService.acceptRequest(requestId);
  }

  @Post('requests/:request_id/reject')
  @RequiresPolicy('REQUEST_REJECT', { request: 'request_id' })
  reject(@Param('request_id') requestId: string): Promise<void> {
    return this.spacesService.rejectRequest(requestId);
  }
}
