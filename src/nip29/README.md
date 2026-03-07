# NIP-29

Utilities for relay-based groups.

This module provides:

- Event kind constants for group metadata, group snapshots, moderation, and membership requests
- Builders for join/leave requests and group state events
- Parsers for group metadata, admins, members, and roles
- Reducers for membership/admin state from snapshot-plus-delta event streams
- Filter builders for querying group metadata, membership, and group-scoped content

Core concepts:

- Group-scoped user events use the `h` tag
- Relay-published group state snapshots use the `d` tag
- Membership can be reconstructed from `kind:39002` snapshots plus newer `kind:9000/9001` moderation events

Primary exports:

- `createGroupJoinRequest`
- `createGroupLeaveRequest`
- `createPutUserEvent`
- `createRemoveUserEvent`
- `createGroupMetadataEvent`
- `parseGroupMetadataEvent`
- `reduceGroupMembers`
- `reduceGroupAdmins`
- `reduceGroupMembershipStatus`
- `buildGroupMetadataFilters`
- `buildGroupMembershipFilters`
