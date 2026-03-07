import {
  GROUP_ADMINS_KIND,
  GROUP_MEMBERS_KIND,
  GROUP_METADATA_KIND,
  GROUP_ROLES_KIND,
  JOIN_REQUEST_KIND,
  LEAVE_REQUEST_KIND,
  GroupMembershipStatus,
  buildGroupContentFilters,
  buildGroupMembershipFilters,
  buildGroupMetadataFilters,
  createEditGroupMetadataEvent,
  createGroupAdminsEvent,
  createGroupJoinRequest,
  createGroupLeaveRequest,
  createGroupMembersEvent,
  createGroupMetadataEvent,
  createGroupRolesEvent,
  createPutUserEvent,
  createRemoveUserEvent,
  parseGroupAdminsEvent,
  parseGroupMembersEvent,
  parseGroupMetadataEvent,
  parseGroupRolesEvent,
  reduceGroupAdmins,
  reduceGroupMembers,
  reduceGroupMembershipStatus,
} from "../../src/nip29";
import { createSignedEvent } from "../../src/nip01/event";
import { generateKeypair } from "../../src/utils/crypto";

describe("NIP-29", () => {
  test("should create and parse group metadata events", async () => {
    const relayKeys = await generateKeypair();
    const unsigned = createGroupMetadataEvent("pizza_lovers", relayKeys.privateKey, {
      name: "Pizza Lovers",
      picture: "https://example.com/pizza.png",
      about: "a group for people who love pizza",
      private: true,
      restricted: true,
      closed: true,
    });
    const event = await createSignedEvent(unsigned, relayKeys.privateKey);

    expect(event.kind).toBe(GROUP_METADATA_KIND);

    const parsed = parseGroupMetadataEvent(event);
    expect(parsed).toMatchObject({
      id: "pizza_lovers",
      name: "Pizza Lovers",
      picture: "https://example.com/pizza.png",
      about: "a group for people who love pizza",
      isPrivate: true,
      isRestricted: true,
      isHidden: false,
      isClosed: true,
    });
  });

  test("should create group join and leave requests", async () => {
    const userKeys = await generateKeypair();

    const joinEvent = createGroupJoinRequest("pizza_lovers", userKeys.privateKey, {
      content: "please let me in",
      code: "invite-123",
    });
    const leaveEvent = createGroupLeaveRequest("pizza_lovers", userKeys.privateKey, {
      content: "bye",
    });

    expect(joinEvent.kind).toBe(JOIN_REQUEST_KIND);
    expect(joinEvent.tags).toEqual([
      ["h", "pizza_lovers"],
      ["code", "invite-123"],
    ]);

    expect(leaveEvent.kind).toBe(LEAVE_REQUEST_KIND);
    expect(leaveEvent.tags).toEqual([["h", "pizza_lovers"]]);
  });

  test("should create and parse group admin, member, and role snapshots", async () => {
    const relayKeys = await generateKeypair();
    const adminPubkey = "a".repeat(64);
    const memberPubkey = "b".repeat(64);

    const adminsEvent = await createSignedEvent(
      createGroupAdminsEvent("pizza_lovers", relayKeys.privateKey, [
        { pubkey: adminPubkey, roles: ["moderator", "founder"] },
      ]),
      relayKeys.privateKey,
    );
    const membersEvent = await createSignedEvent(
      createGroupMembersEvent("pizza_lovers", relayKeys.privateKey, [
        adminPubkey,
        memberPubkey,
      ]),
      relayKeys.privateKey,
    );
    const rolesEvent = await createSignedEvent(
      createGroupRolesEvent("pizza_lovers", relayKeys.privateKey, [
        { name: "moderator", description: "Can moderate posts" },
        { name: "founder" },
      ]),
      relayKeys.privateKey,
    );

    expect(adminsEvent.kind).toBe(GROUP_ADMINS_KIND);
    expect(membersEvent.kind).toBe(GROUP_MEMBERS_KIND);
    expect(rolesEvent.kind).toBe(GROUP_ROLES_KIND);

    expect(parseGroupAdminsEvent(adminsEvent)).toMatchObject({
      id: "pizza_lovers",
      admins: [{ pubkey: adminPubkey, roles: ["moderator", "founder"] }],
    });
    expect(parseGroupMembersEvent(membersEvent)).toMatchObject({
      id: "pizza_lovers",
      members: [adminPubkey, memberPubkey],
    });
    expect(parseGroupRolesEvent(rolesEvent)).toMatchObject({
      id: "pizza_lovers",
      roles: [
        { name: "moderator", description: "Can moderate posts" },
        { name: "founder", description: undefined },
      ],
    });
  });

  test("should build edit-metadata events using on/off flags", async () => {
    const adminKeys = await generateKeypair();
    const event = createEditGroupMetadataEvent(
      "pizza_lovers",
      adminKeys.privateKey,
      {
        name: "Better Pizza Lovers",
        private: false,
        restricted: false,
        hidden: false,
        closed: false,
      },
    );

    expect(event.kind).toBe(9002);
    expect(event.tags).toEqual(
      expect.arrayContaining([
        ["h", "pizza_lovers"],
        ["name", "Better Pizza Lovers"],
        ["public"],
        ["unrestricted"],
        ["visible"],
        ["open"],
      ]),
    );
  });

  test("should preserve explicit metadata clears in edit events", async () => {
    const adminKeys = await generateKeypair();
    const event = createEditGroupMetadataEvent("pizza_lovers", adminKeys.privateKey, {
      name: "",
      picture: "",
      about: "",
    });

    expect(event.tags).toEqual(
      expect.arrayContaining([
        ["h", "pizza_lovers"],
        ["name", ""],
        ["picture", ""],
        ["about", ""],
      ]),
    );
  });

  test("should reduce members from snapshots and newer moderation deltas", async () => {
    const relayKeys = await generateKeypair();
    const adminKeys = await generateKeypair();
    const member1 = "1".repeat(64);
    const member2 = "2".repeat(64);
    const member3 = "3".repeat(64);

    const snapshot = await createSignedEvent(
      {
        ...createGroupMembersEvent("pizza_lovers", relayKeys.privateKey, [
          member1,
          member2,
        ]),
        created_at: 100,
      },
      relayKeys.privateKey,
    );

    const removeMember2 = await createSignedEvent(
      {
        ...createRemoveUserEvent("pizza_lovers", member2, adminKeys.privateKey),
        created_at: 110,
      },
      adminKeys.privateKey,
    );

    const addMember3 = await createSignedEvent(
      {
        ...createPutUserEvent("pizza_lovers", member3, adminKeys.privateKey),
        created_at: 120,
      },
      adminKeys.privateKey,
    );

    expect(
      reduceGroupMembers([snapshot, removeMember2, addMember3], "pizza_lovers"),
    ).toEqual([member1, member3]);
  });

  test("should reduce admins from snapshots and role changes", async () => {
    const relayKeys = await generateKeypair();
    const adminKeys = await generateKeypair();
    const admin1 = "a".repeat(64);
    const admin2 = "b".repeat(64);

    const snapshot = await createSignedEvent(
      {
        ...createGroupAdminsEvent("pizza_lovers", relayKeys.privateKey, [
          { pubkey: admin1, roles: ["founder"] },
        ]),
        created_at: 100,
      },
      relayKeys.privateKey,
    );

    const promoteAdmin2 = await createSignedEvent(
      {
        ...createPutUserEvent("pizza_lovers", admin2, adminKeys.privateKey, {
          roles: ["moderator"],
        }),
        created_at: 110,
      },
      adminKeys.privateKey,
    );

    const demoteAdmin1 = await createSignedEvent(
      {
        ...createPutUserEvent("pizza_lovers", admin1, adminKeys.privateKey),
        created_at: 120,
      },
      adminKeys.privateKey,
    );

    expect(reduceGroupAdmins([snapshot, promoteAdmin2, demoteAdmin1])).toEqual([
      { pubkey: admin2, roles: ["moderator"] },
    ]);
  });

  test("should reduce membership status for pending and granted users", async () => {
    const adminKeys = await generateKeypair();
    const userKeys = await generateKeypair();

    const joinRequest = await createSignedEvent(
      {
        ...createGroupJoinRequest("pizza_lovers", userKeys.privateKey),
        created_at: 100,
      },
      userKeys.privateKey,
    );

    expect(
      reduceGroupMembershipStatus(
        [joinRequest],
        userKeys.publicKey,
        "pizza_lovers",
      ),
    ).toBe(GroupMembershipStatus.Pending);

    const addedToGroup = await createSignedEvent(
      {
        ...createPutUserEvent("pizza_lovers", userKeys.publicKey, adminKeys.privateKey),
        created_at: 110,
      },
      adminKeys.privateKey,
    );

    expect(
      reduceGroupMembershipStatus(
        [joinRequest, addedToGroup],
        userKeys.publicKey,
        "pizza_lovers",
      ),
    ).toBe(GroupMembershipStatus.Granted);
  });

  test("should build metadata, membership, and content filters", () => {
    expect(buildGroupMetadataFilters("pizza_lovers")).toEqual([
      {
        kinds: [39000, 39001, 39002, 39003],
        "#d": ["pizza_lovers"],
      },
    ]);

    expect(buildGroupMembershipFilters("pizza_lovers", "a".repeat(64))).toEqual([
      { kinds: [39002], "#d": ["pizza_lovers"] },
      { kinds: [9000, 9001], "#h": ["pizza_lovers"], "#p": ["a".repeat(64)] },
      { kinds: [9021, 9022], "#h": ["pizza_lovers"], authors: ["a".repeat(64)] },
    ]);

    expect(buildGroupContentFilters("pizza_lovers", [1, 30023])).toEqual([
      { kinds: [1, 30023], "#h": ["pizza_lovers"] },
    ]);
  });

  test("should reject invalid member pubkeys when building membership filters", () => {
    expect(() => buildGroupMembershipFilters("pizza_lovers", "")).toThrow(
      "memberPubkey must be a 64-character lowercase hex string",
    );
  });

  test("should ignore other groups when reducing membership", async () => {
    const adminKeys = await generateKeypair();
    const memberPubkey = "c".repeat(64);

    const pizzaEvent = await createSignedEvent(
      createPutUserEvent("pizza_lovers", memberPubkey, adminKeys.privateKey),
      adminKeys.privateKey,
    );

    const pastaEvent = await createSignedEvent(
      createPutUserEvent("pasta_lovers", memberPubkey, adminKeys.privateKey),
      adminKeys.privateKey,
    );

    expect(
      reduceGroupMembers([pizzaEvent, pastaEvent], "pizza_lovers"),
    ).toEqual([memberPubkey]);
    expect(
      reduceGroupMembershipStatus(
        [pizzaEvent, pastaEvent],
        memberPubkey,
        "pasta_lovers",
      ),
    ).toBe(GroupMembershipStatus.Granted);
  });

  test("should reject empty group ids when reducing members", async () => {
    const adminKeys = await generateKeypair();
    const memberPubkey = "d".repeat(64);

    const event = await createSignedEvent(
      createPutUserEvent("pizza_lovers", memberPubkey, adminKeys.privateKey),
      adminKeys.privateKey,
    );

    expect(() => reduceGroupMembers([event], "")).toThrow(
      "Group id must contain only lowercase letters, numbers, hyphens, or underscores",
    );
  });
});
