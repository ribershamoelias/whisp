import { SetMetadata } from '@nestjs/common';
import { PolicyAction } from './policy.types';

export interface PolicyFieldMap {
  actor?: string;
  target?: string;
  space?: string;
  request?: string;
  to?: string;
}

export interface RequiresPolicyMetadata {
  action: PolicyAction;
  fields?: PolicyFieldMap;
}

export const REQUIRES_POLICY_KEY = 'requires_policy';

export const RequiresPolicy = (action: PolicyAction, fields?: PolicyFieldMap) =>
  SetMetadata(REQUIRES_POLICY_KEY, { action, fields } satisfies RequiresPolicyMetadata);
