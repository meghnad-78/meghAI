# Tool Runtime, Execution Pipeline, and Resource Locks

## 11-Step Tool Execution Pipeline

Every tool call initiated by an agent or user command passes through an unbypassable 11-step execution lifecycle:

1. **Resolution**: Validate tool exists in `ToolRegistry` and schema matches arguments.
2. **Path & Argument Validation**: Check paths against directory traversal attacks (`..`, symlink escapes).
3. **Redaction**: Redact tokens, passwords, and sensitive keys from execution logs.
4. **Risk Assessment**: Compute risk tier (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) using `RiskEngine`.
5. **Permission Verification**: Check `PermissionBroker` for active scope grant.
6. **User Confirmation**: If risk is `HIGH` or `CRITICAL` (or permission mode is `ASK_EVERY_TIME`), generate `ActionPreviewCard` and await explicit user approval.
7. **Resource Locking**: Acquire exclusive lock on target resource (e.g. file path, active window) via `ResourceLockManager`.
8. **Sandbox Execution**: Execute tool handler in isolated, timeout-protected try/catch block.
9. **Outcome Verification**: Confirm result with SHA-256 file hashes, DB records, or API receipts via `VerificationEngine`.
10. **Timeline Persistence**: Append event to immutable `ActionTimeline` and event stream.
11. **Lock Release**: Release resource lock and return truthful verification proof to caller.

## Concurrency and Deadlock Prevention

The `ResourceLockManager` enforces FIFO queueing and auto-expiring leases on locks to prevent deadlocks when multiple subagents or background tasks access filesystem or app resources simultaneously.
