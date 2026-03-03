export type PolicyAction =
  | 'AUTH_LOGIN'
  | 'AUTH_REFRESH'
  | 'AUTH_LOGOUT'
  | 'IDENTITY_REGISTER'
  | 'IDENTITY_REGISTER_DEVICE'
  | 'IDENTITY_BLOCK_ADD'
  | 'IDENTITY_BLOCK_REMOVE'
  | 'SPACE_CREATE'
  | 'SPACE_JOIN'
  | 'SPACE_LEAVE'
  | 'SPACE_ROLE_ASSIGN'
  | 'REQUEST_CREATE'
  | 'REQUEST_ACCEPT'
  | 'REQUEST_REJECT'
  | 'SEND_MESSAGE';

export interface PolicyResourceContext {
  space_id?: string;
  request_id?: string;
  target_wid?: string;
  to_wid?: string;
}

export interface PolicyCheckInput {
  actor_wid: string;
  action: PolicyAction;
  context: PolicyResourceContext;
}
