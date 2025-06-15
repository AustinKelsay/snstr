/**
 * NIP-10 Example: Text Notes and Threads
 * 
 * This example demonstrates NIP-10 threading functionality:
 * - Creating reply threads
 * - Quoting other events
 * - Building thread hierarchies
 * - Parsing thread references
 * 
 * How to run:
 * npm run example:nip10
 */

import { 
  NostrEvent, 
  createReplyTags, 
  createQuoteTag, 
  parseThreadReferences,
  ThreadPointer
} from "../../src";

console.log("🧵 NIP-10: Text Notes and Threads Demo\n");

async function main() {
  console.log("👥 Setting up demo users and events...\n");

  // Mock event IDs and pubkeys for demonstration
  const alicePubkey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const bobPubkey = "1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const charliePubkey = "2123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const rootEventId = "root123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const replyEventId = "repl123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  console.log(`Alice:   ${alicePubkey.slice(0, 16)}...`);
  console.log(`Bob:     ${bobPubkey.slice(0, 16)}...`);
  console.log(`Charlie: ${charliePubkey.slice(0, 16)}...\n`);

  // 1. Demonstrate simple reply
  console.log("💬 Creating simple reply tags...");
  const rootPointer: ThreadPointer = { 
    id: rootEventId, 
    pubkey: alicePubkey,
    relay: "wss://relay.example.com"
  };
  
  const simpleReplyTags = createReplyTags(rootPointer);
  console.log("Simple reply tags:", JSON.stringify(simpleReplyTags, null, 2));
  console.log();

  // 2. Demonstrate nested reply (with both root and reply)
  console.log("🔄 Creating nested reply tags...");
  const replyPointer: ThreadPointer = { 
    id: replyEventId, 
    pubkey: bobPubkey,
    relay: "wss://relay.example.com"
  };
  
  const nestedReplyTags = createReplyTags(rootPointer, replyPointer);
  console.log("Nested reply tags:", JSON.stringify(nestedReplyTags, null, 2));
  console.log();

  // 3. Demonstrate quote tag
  console.log("📖 Creating quote tag...");
  const quotePointer: ThreadPointer = { 
    id: rootEventId, 
    pubkey: alicePubkey,
    relay: "wss://relay.example.com"
  };
  
  const quoteTag = createQuoteTag(quotePointer);
  console.log("Quote tag:", JSON.stringify(quoteTag, null, 2));
  console.log();

  // 4. Create mock events to demonstrate parsing
  console.log("🔍 Parsing thread references from events...\n");

  // Mock root event
  const rootEvent: NostrEvent = {
    kind: 1,
    content: "This is the start of an interesting thread about Nostr!",
    tags: [],
    created_at: Math.floor(Date.now() / 1000),
    pubkey: alicePubkey,
    id: rootEventId,
    sig: "mock_signature"
  };

  // Mock simple reply event
  const replyEvent: NostrEvent = {
    kind: 1,
    content: "Great topic! I think Nostr has huge potential.",
    tags: simpleReplyTags,
    created_at: Math.floor(Date.now() / 1000) + 60,
    pubkey: bobPubkey,
    id: replyEventId,
    sig: "mock_signature"
  };

  // Mock nested reply event
  const nestedReplyEvent: NostrEvent = {
    kind: 1,
    content: "I agree with Bob! The decentralized nature is revolutionary.",
    tags: nestedReplyTags,
    created_at: Math.floor(Date.now() / 1000) + 120,
    pubkey: charliePubkey,
    id: "nest123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    sig: "mock_signature"
  };

  // Mock quote event
  const quoteEvent: NostrEvent = {
    kind: 1,
    content: "This post really got me thinking about the future of social media.",
    tags: [
      quoteTag,
      ["p", alicePubkey] // Mention the original author
    ],
    created_at: Math.floor(Date.now() / 1000) + 180,
    pubkey: charliePubkey,
    id: "quot123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    sig: "mock_signature"
  };

  const events = [rootEvent, replyEvent, nestedReplyEvent, quoteEvent];
  const eventTypes = ["Root Post", "Simple Reply", "Nested Reply", "Quote Event"];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventType = eventTypes[i];
    
    console.log(`📋 ${eventType} (${event.id.slice(0, 8)}...)`);
    console.log(`   Author: ${event.pubkey.slice(0, 8)}...`);
    console.log(`   Content: "${event.content.slice(0, 50)}${event.content.length > 50 ? '...' : ''}"`);
    
    const threadRefs = parseThreadReferences(event);
    
    if (threadRefs.root) {
      console.log(`   🌳 Root: ${threadRefs.root.id.slice(0, 8)}... (${threadRefs.root.pubkey?.slice(0, 8)}...)`);
    }
    if (threadRefs.reply) {
      console.log(`   💬 Reply to: ${threadRefs.reply.id.slice(0, 8)}... (${threadRefs.reply.pubkey?.slice(0, 8)}...)`);
    }
    if (threadRefs.mentions.length > 0) {
      console.log(`   👥 Mentions: ${threadRefs.mentions.length} event(s)`);
    }
    if (threadRefs.quotes.length > 0) {
      console.log(`   📖 Quotes: ${threadRefs.quotes.map(q => q.id.slice(0, 8) + '...').join(', ')}`);
    }
    console.log();
  }

  // 5. Demonstrate thread hierarchy visualization
  console.log("🌳 Thread Hierarchy Visualization:\n");
  
  console.log("📝 Root Post (Alice)");
  console.log("   \"This is the start of an interesting thread about Nostr!\"");
  console.log("   │");
  console.log("   ├── 💬 Reply 1 (Bob)");
  console.log("   │   \"Great topic! I think Nostr has huge potential.\"");
  console.log("   │   │");
  console.log("   │   └── 🔄 Nested Reply (Charlie)");
  console.log("   │       \"I agree with Bob! The decentralized nature is revolutionary.\"");
  console.log("   │");
  console.log("   └── 📖 Quote (Charlie)");
  console.log("       \"This post really got me thinking about the future...\"");
  console.log();

  // 6. Show tag structure examples
  console.log("🏷️  Tag Structure Examples:");
  console.log();
  console.log("Simple Reply (recommended):");
  console.log('["e", "<event_id>", "<relay>", "root", "<pubkey>"]');
  console.log();
  console.log("Complex Thread Reply:");
  console.log('["e", "<root_id>", "<relay>", "root", "<root_pubkey>"]');
  console.log('["e", "<parent_id>", "<relay>", "reply", "<parent_pubkey>"]');
  console.log();
  console.log("Quote/Mention:");
  console.log('["e", "<event_id>", "<relay>", "mention", "<pubkey>"]');
  console.log();

  // 7. Show best practices
  console.log("✨ NIP-10 Best Practices Demonstrated:");
  console.log("✅ Simple reply structure for basic threads");
  console.log("✅ Complex reply structure for nested threads");
  console.log("✅ Proper pubkey references for thread reconstruction");
  console.log("✅ Quote tags with mention markers and relay hints");
  console.log("✅ Thread parsing and reference extraction");
  console.log("✅ Graceful handling of different thread patterns");
  console.log();

  console.log("🎉 NIP-10 threading demo completed successfully!");
  console.log("💡 This demonstrates how to build threaded conversations in Nostr");
  console.log("📚 See examples/nip10/README.md for more details");
}

main().catch((error) => {
  console.error("❌ Demo failed:", error);
  process.exit(1);
}); 