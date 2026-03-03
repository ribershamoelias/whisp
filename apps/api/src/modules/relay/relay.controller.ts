import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RequiresPolicy } from '../../common/authz/requires-policy.decorator';
import {
  RelayMessageInput,
  RelayMessageOutput,
  RelayService
} from './relay.service';

@Controller('relay')
export class RelayController {
  constructor(private readonly relayService: RelayService) {}

  @Post('messages')
  @RequiresPolicy('SEND_MESSAGE', { actor: 'sender_wid', target: 'to_wid', space: 'space_id' })
  send(@Body() body: RelayMessageInput): Promise<{ message_id: string }> {
    return this.relayService.enqueue(body);
  }

  @Get('messages')
  list(@Query('space_id') spaceId: string): Promise<RelayMessageOutput[]> {
    return this.relayService.listBySpace(spaceId);
  }
}
