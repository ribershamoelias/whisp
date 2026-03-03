export type PermissionDenyReason =
  | 'none'
  | 'blocked'
  | 'no_consent'
  | 'role_denied'
  | 'not_member';

export interface PermissionDecision {
  allowed: boolean;
  deny_reason: PermissionDenyReason;
}
