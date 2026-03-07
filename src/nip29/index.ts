import { createAddressableEvent, createEvent, UnsignedEvent } from "../nip01/event";
import { NostrEvent, Filter } from "../types/nostr";
import { getPublicKey } from "../utils/crypto";
import { getUnixTime } from "../utils/time";

export const GROUP_METADATA_KIND = 39000;
export const GROUP_ADMINS_KIND = 39001;
export const GROUP_MEMBERS_KIND = 39002;
export const GROUP_ROLES_KIND = 39003;

export const PUT_USER_KIND = 9000;
export const REMOVE_USER_KIND = 9001;
export const EDIT_METADATA_KIND = 9002;
export const DELETE_EVENT_KIND = 9005;
export const CREATE_GROUP_KIND = 9007;
export const DELETE_GROUP_KIND = 9008;
export const CREATE_INVITE_KIND = 9009;
export const JOIN_REQUEST_KIND = 9021;
export const LEAVE_REQUEST_KIND = 9022;

export enum GroupMembershipStatus {
  Initial = "initial",
  Pending = "pending",
  Granted = "granted",
}

export interface GroupMetadata {
  id: string;
  name?: string;
  picture?: string;
  about?: string;
  isPrivate: boolean;
  isRestricted: boolean;
  isHidden: boolean;
  isClosed: boolean;
}

export interface GroupAdmin {
  pubkey: string;
  roles: string[];
}

export interface GroupRole {
  name: string;
  description?: string;
}

export interface ParsedGroupMetadataEvent extends GroupMetadata {
  event: NostrEvent;
}

export interface ParsedGroupAdminsEvent {
  id: string;
  admins: GroupAdmin[];
  event: NostrEvent;
}

export interface ParsedGroupMembersEvent {
  id: string;
  members: string[];
  event: NostrEvent;
}

export interface ParsedGroupRolesEvent {
  id: string;
  roles: GroupRole[];
  event: NostrEvent;
}

export interface GroupMetadataOptions {
  name?: string;
  picture?: string;
  about?: string;
  private?: boolean;
  restricted?: boolean;
  hidden?: boolean;
  closed?: boolean;
  additionalTags?: string[][];
}

export interface GroupMetadataEditOptions extends GroupMetadataOptions {
  content?: string;
  previous?: string[];
}

export interface GroupMembershipEventOptions {
  content?: string;
  roles?: string[];
  previous?: string[];
  code?: string;
  created_at?: number;
  additionalTags?: string[][];
}

function hasOwn(options: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(options, key);
}

function assertGroupId(groupId: string): void {
  if (!/^[a-z0-9_-]+$/.test(groupId)) {
    throw new Error(
      "Group id must contain only lowercase letters, numbers, hyphens, or underscores",
    );
  }
}

function assertPubkey(pubkey: string, field = "pubkey"): void {
  if (!/^[0-9a-f]{64}$/.test(pubkey)) {
    throw new Error(`${field} must be a 64-character lowercase hex string`);
  }
}

function compareEventsDesc(a: NostrEvent, b: NostrEvent): number {
  if (a.created_at !== b.created_at) {
    return b.created_at - a.created_at;
  }
  return b.id.localeCompare(a.id);
}

function compareEventsAsc(a: NostrEvent, b: NostrEvent): number {
  if (a.created_at !== b.created_at) {
    return a.created_at - b.created_at;
  }
  return a.id.localeCompare(b.id);
}

function getFirstTagValue(tags: string[][], tagName: string): string | undefined {
  return tags.find((tag) => tag[0] === tagName)?.[1];
}

function getValidatedPubkey(tag: string[] | undefined): string | undefined {
  const pubkey = tag?.[1];
  if (typeof pubkey !== "string") {
    return undefined;
  }

  try {
    assertPubkey(pubkey);
    return pubkey;
  } catch {
    return undefined;
  }
}

function getValidatedPubkeys(tags: string[][]): string[] {
  return tags
    .filter((tag) => tag[0] === "p")
    .map((tag) => getValidatedPubkey(tag))
    .filter((pubkey): pubkey is string => pubkey !== undefined);
}

function getRoleValues(tag: string[]): string[] {
  return tag.slice(2).filter((value) => typeof value === "string" && value.length > 0);
}

function getPreviousTags(previous: string[] = []): string[][] {
  return previous.map((eventId) => ["previous", eventId]);
}

function getAdditionalTags(additionalTags: string[][] = []): string[][] {
  return additionalTags.map((tag) => [...tag]);
}

function buildGroupScopedUnsignedEvent(
  kind: number,
  groupId: string,
  privateKey: string,
  content = "",
  tags: string[][] = [],
  created_at = getUnixTime(),
): UnsignedEvent {
  assertGroupId(groupId);

  return createEvent(
    {
      kind,
      content,
      tags: [["h", groupId], ...tags],
      created_at,
    },
    getPublicKey(privateKey),
  );
}

export function createGroupJoinRequest(
  groupId: string,
  privateKey: string,
  options: GroupMembershipEventOptions = {},
): UnsignedEvent {
  const tags = [
    ...(options.code ? [["code", options.code]] : []),
    ...getPreviousTags(options.previous),
    ...getAdditionalTags(options.additionalTags),
  ];

  return buildGroupScopedUnsignedEvent(
    JOIN_REQUEST_KIND,
    groupId,
    privateKey,
    options.content ?? "",
    tags,
    options.created_at,
  );
}

export function createGroupLeaveRequest(
  groupId: string,
  privateKey: string,
  options: GroupMembershipEventOptions = {},
): UnsignedEvent {
  return buildGroupScopedUnsignedEvent(
    LEAVE_REQUEST_KIND,
    groupId,
    privateKey,
    options.content ?? "",
    [
      ...getPreviousTags(options.previous),
      ...getAdditionalTags(options.additionalTags),
    ],
    options.created_at,
  );
}

export function createPutUserEvent(
  groupId: string,
  targetPubkey: string,
  privateKey: string,
  options: GroupMembershipEventOptions = {},
): UnsignedEvent {
  assertPubkey(targetPubkey, "targetPubkey");

  return buildGroupScopedUnsignedEvent(
    PUT_USER_KIND,
    groupId,
    privateKey,
    options.content ?? "",
    [
      ["p", targetPubkey, ...(options.roles ?? [])],
      ...getPreviousTags(options.previous),
      ...getAdditionalTags(options.additionalTags),
    ],
    options.created_at,
  );
}

export function createRemoveUserEvent(
  groupId: string,
  targetPubkey: string,
  privateKey: string,
  options: GroupMembershipEventOptions = {},
): UnsignedEvent {
  assertPubkey(targetPubkey, "targetPubkey");

  return buildGroupScopedUnsignedEvent(
    REMOVE_USER_KIND,
    groupId,
    privateKey,
    options.content ?? "",
    [
      ["p", targetPubkey],
      ...getPreviousTags(options.previous),
      ...getAdditionalTags(options.additionalTags),
    ],
    options.created_at,
  );
}

export function createEditGroupMetadataEvent(
  groupId: string,
  privateKey: string,
  options: GroupMetadataEditOptions = {},
): UnsignedEvent {
  const tags: string[][] = [];

  if (hasOwn(options, "name")) tags.push(["name", options.name ?? ""]);
  if (hasOwn(options, "picture")) tags.push(["picture", options.picture ?? ""]);
  if (hasOwn(options, "about")) tags.push(["about", options.about ?? ""]);

  if (options.private === true) tags.push(["private"]);
  if (options.private === false) tags.push(["public"]);
  if (options.restricted === true) tags.push(["restricted"]);
  if (options.restricted === false) tags.push(["unrestricted"]);
  if (options.hidden === true) tags.push(["hidden"]);
  if (options.hidden === false) tags.push(["visible"]);
  if (options.closed === true) tags.push(["closed"]);
  if (options.closed === false) tags.push(["open"]);

  return buildGroupScopedUnsignedEvent(
    EDIT_METADATA_KIND,
    groupId,
    privateKey,
    options.content ?? "",
    [
      ...tags,
      ...getPreviousTags(options.previous),
      ...getAdditionalTags(options.additionalTags),
    ],
  );
}

export function createGroupMetadataEvent(
  groupId: string,
  privateKey: string,
  options: GroupMetadataOptions = {},
  content = "",
): UnsignedEvent {
  assertGroupId(groupId);

  const tags: string[][] = [];
  if (options.name) tags.push(["name", options.name]);
  if (options.picture) tags.push(["picture", options.picture]);
  if (options.about) tags.push(["about", options.about]);
  if (options.private) tags.push(["private"]);
  if (options.restricted) tags.push(["restricted"]);
  if (options.hidden) tags.push(["hidden"]);
  if (options.closed) tags.push(["closed"]);

  return createAddressableEvent(
    GROUP_METADATA_KIND,
    groupId,
    content,
    privateKey,
    [...tags, ...getAdditionalTags(options.additionalTags)],
  );
}

export function createGroupAdminsEvent(
  groupId: string,
  privateKey: string,
  admins: GroupAdmin[],
  content = "",
): UnsignedEvent {
  assertGroupId(groupId);
  const tags = admins.map((admin) => {
    assertPubkey(admin.pubkey, "admin pubkey");
    return ["p", admin.pubkey, ...admin.roles];
  });

  return createAddressableEvent(
    GROUP_ADMINS_KIND,
    groupId,
    content,
    privateKey,
    tags,
  );
}

export function createGroupMembersEvent(
  groupId: string,
  privateKey: string,
  members: string[],
  content = "",
): UnsignedEvent {
  assertGroupId(groupId);
  const tags = members.map((memberPubkey) => {
    assertPubkey(memberPubkey, "member pubkey");
    return ["p", memberPubkey];
  });

  return createAddressableEvent(
    GROUP_MEMBERS_KIND,
    groupId,
    content,
    privateKey,
    tags,
  );
}

export function createGroupRolesEvent(
  groupId: string,
  privateKey: string,
  roles: GroupRole[],
  content = "",
): UnsignedEvent {
  assertGroupId(groupId);
  const tags = roles.map((role) =>
    role.description
      ? ["role", role.name, role.description]
      : ["role", role.name],
  );

  return createAddressableEvent(
    GROUP_ROLES_KIND,
    groupId,
    content,
    privateKey,
    tags,
  );
}

export function parseGroupMetadataEvent(
  event: NostrEvent,
): ParsedGroupMetadataEvent {
  if (event.kind !== GROUP_METADATA_KIND) {
    throw new Error("Invalid group metadata event kind");
  }

  const id = getFirstTagValue(event.tags, "d");
  if (!id) {
    throw new Error("Group metadata event is missing d tag");
  }
  assertGroupId(id);

  return {
    id,
    name: getFirstTagValue(event.tags, "name"),
    picture: getFirstTagValue(event.tags, "picture"),
    about: getFirstTagValue(event.tags, "about"),
    isPrivate: event.tags.some((tag) => tag[0] === "private"),
    isRestricted: event.tags.some((tag) => tag[0] === "restricted"),
    isHidden: event.tags.some((tag) => tag[0] === "hidden"),
    isClosed: event.tags.some((tag) => tag[0] === "closed"),
    event,
  };
}

export function parseGroupAdminsEvent(
  event: NostrEvent,
): ParsedGroupAdminsEvent {
  if (event.kind !== GROUP_ADMINS_KIND) {
    throw new Error("Invalid group admins event kind");
  }

  const id = getFirstTagValue(event.tags, "d");
  if (!id) {
    throw new Error("Group admins event is missing d tag");
  }
  assertGroupId(id);

  return {
    id,
    admins: event.tags
      .filter((tag) => tag[0] === "p" && getValidatedPubkey(tag) !== undefined)
      .map((tag) => ({
        pubkey: getValidatedPubkey(tag)!,
        roles: getRoleValues(tag),
      })),
    event,
  };
}

export function parseGroupMembersEvent(
  event: NostrEvent,
): ParsedGroupMembersEvent {
  if (event.kind !== GROUP_MEMBERS_KIND) {
    throw new Error("Invalid group members event kind");
  }

  const id = getFirstTagValue(event.tags, "d");
  if (!id) {
    throw new Error("Group members event is missing d tag");
  }
  assertGroupId(id);

  return {
    id,
    members: getValidatedPubkeys(event.tags),
    event,
  };
}

export function parseGroupRolesEvent(
  event: NostrEvent,
): ParsedGroupRolesEvent {
  if (event.kind !== GROUP_ROLES_KIND) {
    throw new Error("Invalid group roles event kind");
  }

  const id = getFirstTagValue(event.tags, "d");
  if (!id) {
    throw new Error("Group roles event is missing d tag");
  }
  assertGroupId(id);

  return {
    id,
    roles: event.tags
      .filter((tag) => tag[0] === "role" && typeof tag[1] === "string")
      .map((tag) => ({
        name: tag[1],
        description: tag[2],
      })),
    event,
  };
}

function filterEventsByGroupId(events: NostrEvent[], groupId?: string): NostrEvent[] {
  if (groupId === undefined) return events;
  assertGroupId(groupId);

  return events.filter((event) => {
    const isSnapshotKind = [
      GROUP_METADATA_KIND,
      GROUP_ADMINS_KIND,
      GROUP_MEMBERS_KIND,
      GROUP_ROLES_KIND,
    ].includes(event.kind);
    const scopedGroupId = isSnapshotKind
      ? getFirstTagValue(event.tags, "d") ?? getFirstTagValue(event.tags, "h")
      : getFirstTagValue(event.tags, "h") ?? getFirstTagValue(event.tags, "d");
    return scopedGroupId === groupId;
  });
}

function getLatestAddressableSnapshot(
  events: NostrEvent[],
  kind: number,
): NostrEvent | undefined {
  return events
    .filter((event) => event.kind === kind)
    .sort(compareEventsDesc)[0];
}

export function reduceGroupMembers(
  events: NostrEvent[],
  groupId?: string,
): string[] {
  const scopedEvents = filterEventsByGroupId(events, groupId);
  const latestMembersSnapshot = getLatestAddressableSnapshot(
    scopedEvents,
    GROUP_MEMBERS_KIND,
  );

  const members = new Set<string>(
    latestMembersSnapshot ? parseGroupMembersEvent(latestMembersSnapshot).members : [],
  );

  const moderationEvents = scopedEvents
    .filter((event) => {
      if (![PUT_USER_KIND, REMOVE_USER_KIND].includes(event.kind)) {
        return false;
      }
      if (!latestMembersSnapshot) return true;
      return compareEventsAsc(event, latestMembersSnapshot) > 0;
    })
    .sort(compareEventsAsc);

  for (const event of moderationEvents) {
    const targetPubkey = getValidatedPubkey(
      event.tags.find((tag) => tag[0] === "p"),
    );
    if (!targetPubkey) continue;

    if (event.kind === PUT_USER_KIND) {
      members.add(targetPubkey);
    } else if (event.kind === REMOVE_USER_KIND) {
      members.delete(targetPubkey);
    }
  }

  return Array.from(members);
}

export function reduceGroupAdmins(
  events: NostrEvent[],
  groupId?: string,
): GroupAdmin[] {
  const scopedEvents = filterEventsByGroupId(events, groupId);
  const latestAdminsSnapshot = getLatestAddressableSnapshot(
    scopedEvents,
    GROUP_ADMINS_KIND,
  );

  const adminMap = new Map<string, string[]>();

  if (latestAdminsSnapshot) {
    for (const admin of parseGroupAdminsEvent(latestAdminsSnapshot).admins) {
      adminMap.set(admin.pubkey, admin.roles);
    }
  }

  const moderationEvents = scopedEvents
    .filter((event) => {
      if (![PUT_USER_KIND, REMOVE_USER_KIND].includes(event.kind)) {
        return false;
      }
      if (!latestAdminsSnapshot) return true;
      return compareEventsAsc(event, latestAdminsSnapshot) > 0;
    })
    .sort(compareEventsAsc);

  for (const event of moderationEvents) {
    const targetTag = event.tags.find((tag) => tag[0] === "p");
    const targetPubkey = getValidatedPubkey(targetTag);
    if (!targetPubkey) continue;

    if (event.kind === REMOVE_USER_KIND) {
      adminMap.delete(targetPubkey);
      continue;
    }

    const roles = targetTag ? getRoleValues(targetTag) : [];
    if (roles.length > 0) {
      adminMap.set(targetPubkey, roles);
    } else {
      adminMap.delete(targetPubkey);
    }
  }

  return Array.from(adminMap.entries()).map(([pubkey, roles]) => ({
    pubkey,
    roles,
  }));
}

export function reduceGroupMembershipStatus(
  events: NostrEvent[],
  memberPubkey: string,
  groupId?: string,
): GroupMembershipStatus {
  assertPubkey(memberPubkey, "memberPubkey");
  const scopedEvents = filterEventsByGroupId(events, groupId);
  const members = reduceGroupMembers(scopedEvents);
  const isMember = members.includes(memberPubkey);

  const relevantEvents = scopedEvents
    .filter((event) => {
      if ([JOIN_REQUEST_KIND, LEAVE_REQUEST_KIND].includes(event.kind)) {
        return event.pubkey === memberPubkey;
      }

      if ([PUT_USER_KIND, REMOVE_USER_KIND].includes(event.kind)) {
        return getFirstTagValue(event.tags, "p") === memberPubkey;
      }

      return false;
    })
    .sort(compareEventsDesc);

  const latestEvent = relevantEvents[0];
  if (!latestEvent) {
    return isMember ? GroupMembershipStatus.Granted : GroupMembershipStatus.Initial;
  }

  if (latestEvent.kind === JOIN_REQUEST_KIND) {
    return isMember ? GroupMembershipStatus.Granted : GroupMembershipStatus.Pending;
  }

  if (latestEvent.kind === PUT_USER_KIND) {
    return GroupMembershipStatus.Granted;
  }

  return isMember ? GroupMembershipStatus.Granted : GroupMembershipStatus.Initial;
}

export function buildGroupMetadataFilters(groupId: string): Filter[] {
  assertGroupId(groupId);
  return [
    {
      kinds: [
        GROUP_METADATA_KIND,
        GROUP_ADMINS_KIND,
        GROUP_MEMBERS_KIND,
        GROUP_ROLES_KIND,
      ],
      "#d": [groupId],
    },
  ];
}

export function buildGroupMembershipFilters(
  groupId: string,
  memberPubkey?: string,
): Filter[] {
  assertGroupId(groupId);
  if (memberPubkey !== undefined) {
    assertPubkey(memberPubkey, "memberPubkey");
  }

  const memberFilter = memberPubkey !== undefined ? { "#p": [memberPubkey] } : {};
  const authorFilter = memberPubkey !== undefined ? { authors: [memberPubkey] } : {};

  return [
    { kinds: [GROUP_MEMBERS_KIND], "#d": [groupId] },
    { kinds: [PUT_USER_KIND, REMOVE_USER_KIND], "#h": [groupId], ...memberFilter },
    { kinds: [JOIN_REQUEST_KIND, LEAVE_REQUEST_KIND], "#h": [groupId], ...authorFilter },
  ];
}

export function buildGroupContentFilters(
  groupId: string,
  kinds: number[],
): Filter[] {
  assertGroupId(groupId);
  return [{ kinds, "#h": [groupId] }];
}
