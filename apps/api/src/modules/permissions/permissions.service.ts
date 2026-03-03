import { Injectable } from '@nestjs/common';
import { PermissionDecision } from '../../common/types';
import { PolicyCheckInput } from '../../common/authz/policy.types';
import { BlockRegistryService } from '../../common/state/block-registry.service';

export interface DmEligibilityInput {
  from_wid: string;
  to_wid: string;
}

export interface SpaceActionInput {
  wid: string;
  space_id: string;
  action: string;
}

@Injectable()
export class PermissionsService {
  constructor(private readonly blockRegistry: BlockRegistryService) {}

  async authorize(input: PolicyCheckInput): Promise<PermissionDecision> {
    const target = input.context.target_wid ?? input.context.to_wid;
    if (target && this.blockRegistry.isBlocked(input.actor_wid, target)) {
      return { allowed: false, deny_reason: 'blocked' };
    }

    return { allowed: true, deny_reason: 'none' };
  }

  async checkDmEligibility(_input: DmEligibilityInput): Promise<PermissionDecision> {
    return this.authorize({
      actor_wid: _input.from_wid,
      action: 'SEND_MESSAGE',
      context: { to_wid: _input.to_wid }
    });
  }

  async checkSpaceAction(_input: SpaceActionInput): Promise<PermissionDecision> {
    return this.authorize({
      actor_wid: _input.wid,
      action: 'SPACE_ROLE_ASSIGN',
      context: { space_id: _input.space_id }
    });
  }
}
