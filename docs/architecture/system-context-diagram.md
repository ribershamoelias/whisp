# WHISP System Context Diagram (Phase 1)

```mermaid
flowchart LR
    U1[Mobile User A] -->|HTTPS/WSS| API[WHISP API Gateway]
    U2[Mobile User B] -->|HTTPS/WSS| API

    API --> AUTH[Auth Module]
    API --> ID[Identity Module]
    API --> SP[Spaces Module]
    API --> PERM[Permissions Module]
    API --> RELAY[Relay Module]

    AUTH --> PG[(PostgreSQL)]
    ID --> PG
    SP --> PG
    PERM --> PG
    RELAY --> PG

    API --> REDIS[(Redis)]

    RELAY --> PUSH[Push Provider]

    note1[Server stores ciphertext payloads only]
    RELAY -.-> note1
```

## Boundaries
- Client performs key generation, session establishment, encrypt/decrypt.
- Server validates auth, permissions, routing, membership, and stores encrypted blobs.
- Global block applies at `wid` level across all communication paths.
