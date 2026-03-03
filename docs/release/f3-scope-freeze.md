# F3 Scope Freeze (1:1 Signal PreKey)

Phase: `F3`
Status: `Frozen`
Date: `2026-03-04`

## Implementation Decision
- Signal stack: **Wrapped native `libsignal-client` via FFI**.
- No custom crypto, no own key-derivation code, no custom ratchet implementation.

## In Scope (Non-Negotiable)
- X3DH / PreKey bundle flow for 1:1 session bootstrap.
- 1:1 session initiation and first encrypted message flow.
- Double Ratchet state creation and state advancement for 1:1.
- Ciphertext-only relay transport for 1:1 payloads.
- Multi-device handling per WID (device-addressed sessions).

## Out of Scope (Non-Negotiable)
- Groups.
- Sender keys.
- MLS.
- Group forward secrecy.
- Media attachments.
- UX features and chat polish.
- Presence or typing indicators.

## Multi-Device Model (Frozen)
- Each device has its own Signal identity key pair.
- Each device publishes its own signed prekey + one-time prekeys.
- Session addressing key is `(recipient_wid, recipient_device_id)`.
- Cross-device session state sharing is forbidden.

## Server Capability Boundary (Frozen)
Server may:
- Store identity public key metadata and per-device prekey bundles.
- Mark one-time prekeys as used atomically.
- Relay ciphertext envelopes.

Server may not:
- Access ratchet state.
- Decrypt payloads.
- Derive shared secrets.
- Execute Signal session operations.

## Explicit No-Group Guarantee
- Any endpoint/schema/task that introduces group routing, sender keys, or MLS is a scope violation for F3.

## CI Scope-Drift Blockers
F3 CI must fail if any of the following appears in F3 changes:
- Group endpoints (`/groups`, `/spaces/*/group`, sender-key routes).
- MLS-related imports or protocol modules.
- Media/message attachment pipeline changes.
- Presence/typing event endpoints.
- Server-side crypto calls in relay/session modules.

## F3 Stop Conditions
- PreKey flow implemented without replay protection.
- One-time prekey can be consumed more than once.
- Identity key change is not detected deterministically.
- Any server-side decrypt/derive behavior appears.
