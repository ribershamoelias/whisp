import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { RequiresPolicy } from '../../common/authz/requires-policy.decorator';
import {
  CiphertextMessageSendOutput,
  ConversationCreateInput,
  ConversationOutput,
  DeliveryStateUpdateInput,
  MessageMetadataOutput,
  RelayEchoInput,
  RelayEchoOutput,
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

  @Post('conversations')
  @RequiresPolicy('SEND_MESSAGE', { actor: 'initiator_wid', target: 'target_wid' })
  createConversation(@Body() body: ConversationCreateInput): Promise<ConversationOutput> {
    return this.relayService.createConversation(body);
  }

  @Post('messages/metadata')
  @RequiresPolicy('SEND_MESSAGE', { actor: 'sender_wid' })
  storeMessageMetadata(@Body() body: unknown): Promise<MessageMetadataOutput> {
    return this.relayService.storeMessageMetadata(body);
  }

  @Post('messages/send')
  @RequiresPolicy('SEND_MESSAGE', { actor: 'sender_wid' })
  sendCiphertextMessage(@Body() body: unknown): Promise<CiphertextMessageSendOutput> {
    return this.relayService.sendCiphertextMessage(body);
  }

  @Post('messages/delivered')
  @HttpCode(204)
  @RequiresPolicy('SEND_MESSAGE', { actor: 'target_wid' })
  async markDelivered(@Body() body: DeliveryStateUpdateInput): Promise<void> {
    await this.relayService.markDelivered(body);
  }

  @Post('messages/read')
  @HttpCode(204)
  @RequiresPolicy('SEND_MESSAGE', { actor: 'target_wid' })
  async markRead(@Body() body: DeliveryStateUpdateInput): Promise<void> {
    await this.relayService.markRead(body);
  }

  @Get('messages')
  list(@Query('space_id') spaceId: string): Promise<RelayMessageOutput[]> {
    return this.relayService.listBySpace(spaceId);
  }

  @Post('echo')
  @RequiresPolicy('SEND_MESSAGE', { actor: 'wid' })
  echo(@Body() body: RelayEchoInput): Promise<RelayEchoOutput> {
    return this.relayService.submitEcho(body);
  }

  @Get('echo/:message_id')
  getEcho(
    @Param('message_id') messageId: string,
    @Query('wid') wid: string,
    @Query('device_id') deviceId: string
  ): Promise<RelayEchoOutput> {
    return this.relayService.getEcho(wid, deviceId, messageId);
  }
}
