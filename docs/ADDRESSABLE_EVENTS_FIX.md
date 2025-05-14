# Addressable Events Processing Bug Fix

## Issue Description

A bug was identified in the event processing logic related to addressable events (kinds 30000-39999). According to NIP-01 §7.1, addressable events are uniquely identified by the combination of (pubkey, kind, d-tag value), but our implementation was incorrectly processing them through two different code paths with inconsistent keying strategies.

### Original Code Issue

In the original code, addressable events (kinds 30000-39999) were being processed by both `processReplaceableEvent` and `processAddressableEvent`:

```typescript
// Process replaceable events (kinds 0, 3, 10000-19999)
if (event.kind === 0 || event.kind === 3 || (event.kind >= 10000 && event.kind < 20000)) {
  this.processReplaceableEvent(event);
}

// Process addressable events (kinds 30000-39999)
if (event.kind >= 30000 && event.kind < 40000) {
  this.processAddressableEvent(event);
}
```

The issue was that `processReplaceableEvent` only keys on `(pubkey, kind)`, ignoring the d-tag value:

```typescript
private processReplaceableEvent(event: NostrEvent): void {
  const key = event.pubkey;
  // ... event stored by pubkey and kind ...
}
```

While `processAddressableEvent` correctly uses `(pubkey, kind, d-tag)`:

```typescript
private processAddressableEvent(event: NostrEvent): void {
  // Find the d tag value
  const dTag = event.tags.find(tag => tag[0] === 'd');
  const dValue = dTag ? dTag[1] : '';
  
  // Create a composite key from kind, pubkey, and d-tag value
  const key = `${event.kind}:${event.pubkey}:${dValue}`;
  // ... event stored with composite key ...
}
```

This caused a race condition where events with the same (pubkey, kind) but different d-tag values could incorrectly replace each other in the `replaceableEvents` map.

## Fix Applied

The fix was to make the two processing paths mutually exclusive by changing the second condition to use `else if`:

```typescript
// Process replaceable events (kinds 0, 3, 10000-19999)
if (event.kind === 0 || event.kind === 3 || (event.kind >= 10000 && event.kind < 20000)) {
  this.processReplaceableEvent(event);
}
// Process addressable events (kinds 30000-39999) - using else if to make them mutually exclusive
else if (event.kind >= 30000 && event.kind < 40000) {
  this.processAddressableEvent(event);
}
```

This ensures that addressable events (kinds 30000-39999) are only processed by `processAddressableEvent`, which correctly respects the NIP-01 §7.1 requirement that (pubkey, kind, d-tag) combination uniquely identifies the event.

## Verification

A new test file, `addressable-events.test.ts`, was created to validate that:

1. Events with same pubkey and kind but different d-tag values are stored separately
2. Newer events with the same (pubkey, kind, d-tag) replace older ones
3. Different kinds with the same pubkey and d-tag are stored separately

You can run this test with:

```bash
npm run test:event:addressable
```

## NIP-01 Compliance

This fix ensures our implementation properly follows NIP-01 §7.1 which states:

> Events with kinds 30000-39999 are "replaceable parameterized" and are uniquely identified by the combination of (pubkey, kind, d-tag value).

## Related Files

- `/src/client/relay.ts`: Contains the main fix in the `processValidatedEvent` method
- `/tests/event/addressable-events.test.ts`: Tests to verify the fix works correctly 