# Sequence: Block During Active Session

```mermaid
sequenceDiagram
    participant A as User A (blocker)
    participant API as API Gateway
    participant ID as Identity Module
    participant PERM as Permissions Module
    participant RELAY as Relay Module
    participant B as User B (blocked)

    A->>API: POST /identity/blocks/{target_wid}
    API->>ID: persist block(A,B)
    ID-->>API: block stored
    API->>PERM: invalidate permission cache for pair(A,B)
    PERM-->>API: cache invalidated
    API-->>A: 204 No Content

    Note over B,RELAY: Existing app session may still be connected

    B->>API: POST /relay/messages (ciphertext to A)
    API->>PERM: authorize(action=send_message, actor=B, target=A)
    PERM-->>API: deny (blocked)
    API-->>B: 403 BLOCKED

    B->>API: POST /spaces/requests (to A)
    API->>PERM: authorize(action=create_request, actor=B, target=A)
    PERM-->>API: deny (blocked)
    API-->>B: 403 BLOCKED
```

## Enforcement Decision
- Block is effective immediately for all new actions.
- Existing cryptographic sessions are not trusted for authorization.
- Authorization is server-side per action; active connection does not bypass block.
- Phase 1 behavior: messaging is stopped immediately; spaces are not auto-deleted.
