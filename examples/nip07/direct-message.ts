import "../../src/nip07/ambient";
import {
  Nip07Nostr,
  hasNip07Support,
  getNip07PublicKey,
  RelayEvent,
} from "../../src";

/**
 * Example showing how to send and receive direct messages using NIP-07
 */
async function directMessageExample() {
  // Update status with what we're checking
  const statusDiv = document.getElementById("status") as HTMLDivElement;
  if (statusDiv) {
    statusDiv.textContent = "Checking for NIP-07 extension...";
  }

  console.log("Checking for window.nostr:", window.nostr);

  // First check if there's a NIP-07 browser extension available
  if (!hasNip07Support()) {
    const errorMessage =
      "No NIP-07 compatible extension detected. Please install one of: nos2x, Alby, or noStrudel";
    console.error(errorMessage);

    if (statusDiv) {
      statusDiv.textContent = errorMessage;
      statusDiv.style.backgroundColor = "#ffebee";
    }

    console.error(
      "- nos2x (Chrome): https://chrome.google.com/webstore/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp",
    );
    console.error("- Alby (Chrome/Firefox): https://getalby.com/");
    console.error(
      "- noStrudel (Firefox): https://addons.mozilla.org/en-US/firefox/addon/nostrudel/",
    );
    return;
  }

  try {
    if (statusDiv) {
      statusDiv.textContent = "NIP-07 extension found! Getting public key...";
    }

    // Get public key from the extension
    const pubkey = await getNip07PublicKey();
    console.log(`Connected with public key: ${pubkey}`);

    if (statusDiv) {
      statusDiv.textContent = `Connected with public key: ${pubkey}`;
      statusDiv.style.backgroundColor = "#e8f5e9";
    }

    // Initialize client with some relays
    const client = new Nip07Nostr([
      "wss://relay.damus.io",
      "wss://relay.nostr.band",
      "wss://nos.lol",
    ]);

    // Connect to the relays
    await client.connectToRelays();
    console.log("Connected to relays");

    // Initialize with the NIP-07 extension's public key
    await client.initializeWithNip07();

    // Set up event handlers for relay events
    client.on(RelayEvent.Connect, (relay) => {
      console.log(`Connected to ${relay}`);
    });

    // UI Elements - in a real application, these would be part of your UI framework
    const recipientInput = document.getElementById(
      "recipient-input",
    ) as HTMLInputElement;
    const messageInput = document.getElementById(
      "message-input",
    ) as HTMLTextAreaElement;
    const sendButton = document.getElementById(
      "send-button",
    ) as HTMLButtonElement;
    const messagesContainer = document.getElementById(
      "messages",
    ) as HTMLDivElement;

    if (sendButton) {
      sendButton.addEventListener("click", async () => {
        if (!recipientInput?.value) {
          statusDiv.textContent = "Please enter a recipient public key";
          return;
        }

        if (!messageInput?.value) {
          statusDiv.textContent = "Please enter a message";
          return;
        }

        try {
          statusDiv.textContent = "Sending message...";
          const dmEvent = await client.publishDirectMessage(
            messageInput.value,
            recipientInput.value,
          );

          if (dmEvent) {
            statusDiv.textContent = `Message sent! ID: ${dmEvent.id}`;

            // Add sent message to the UI
            const messageElement = document.createElement("div");
            messageElement.className = "message sent";
            messageElement.innerHTML = `
              <p><strong>To:</strong> ${recipientInput.value.substring(0, 10)}...${recipientInput.value.substring(recipientInput.value.length - 5)}</p>
              <p><strong>Message:</strong> ${messageInput.value}</p>
              <p><small>Sent at ${new Date().toLocaleTimeString()}</small></p>
            `;
            messagesContainer?.appendChild(messageElement);

            // Clear the message input but keep recipient for conversation
            messageInput.value = "";
          } else {
            statusDiv.textContent = "Failed to send message";
            statusDiv.style.backgroundColor = "#ffebee";
          }
        } catch (error) {
          console.error("Error sending message:", error);
          statusDiv.textContent = `Error: ${error}`;
          statusDiv.style.backgroundColor = "#ffebee";
        }
      });
    }

    // Subscribe to direct messages received by our public key
    client.subscribe([{ kinds: [4], "#p": [pubkey] }], async (event, relay) => {
      console.log(`Received DM from ${relay}:`, event);

      try {
        // Decrypt the message using the async API
        const decryptedContent = await client.decryptDirectMessageAsync(event);

        // Add received message to the UI
        const messageElement = document.createElement("div");
        messageElement.className = "message received";
        messageElement.innerHTML = `
            <p><strong>From:</strong> ${event.pubkey.substring(0, 10)}...${event.pubkey.substring(event.pubkey.length - 5)}</p>
            <p><strong>Message:</strong> ${decryptedContent}</p>
            <p><small>Received at ${new Date().toLocaleTimeString()} from ${relay}</small></p>
          `;
        messagesContainer?.appendChild(messageElement);
      } catch (error) {
        console.error("Failed to decrypt message:", error);

        // Add error message to the UI
        const messageElement = document.createElement("div");
        messageElement.className = "message error";
        messageElement.innerHTML = `
            <p><strong>Error decrypting message from:</strong> ${event.pubkey.substring(0, 10)}...${event.pubkey.substring(event.pubkey.length - 5)}</p>
            <p><strong>Error:</strong> ${error}</p>
          `;
        messagesContainer?.appendChild(messageElement);
      }
    });
  } catch (error) {
    console.error("Error in Direct Message example:", error);
    if (statusDiv) {
      statusDiv.textContent = `Error: ${error}`;
      statusDiv.style.backgroundColor = "#ffebee";
    }
  }
}

// Call the example function when the page loads
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", directMessageExample);
}

// Example HTML structure:
/*
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SNSTR NIP-07 Direct Messages</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    input, textarea {
      width: 100%;
      margin: 10px 0;
      padding: 8px;
    }
    textarea {
      height: 100px;
    }
    button {
      padding: 10px 15px;
      background-color: #1d9bf0;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .message {
      border: 1px solid #ccc;
      padding: 10px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .message.sent {
      background-color: #e6f7ff;
      border-color: #91d5ff;
    }
    .message.received {
      background-color: #f6ffed;
      border-color: #b7eb8f;
    }
    .message.error {
      background-color: #fff2f0;
      border-color: #ffccc7;
    }
    #status {
      margin: 10px 0;
      padding: 10px;
      background-color: #f0f0f0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1>SNSTR NIP-07 Direct Messages</h1>
  <div id="status">Checking for NIP-07 extension...</div>
  
  <h2>Send a Direct Message</h2>
  <input id="recipient-input" placeholder="Recipient's public key (hex)" />
  <textarea id="message-input" placeholder="Type your message here..."></textarea>
  <button id="send-button">Send Message</button>
  
  <h2>Conversation</h2>
  <div id="messages"></div>
  
  <script src="direct-message.js"></script>
</body>
</html>
*/
