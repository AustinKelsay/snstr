import {
  Nip07Nostr,
  hasNip07Support,
  getNip07PublicKey,
  RelayEvent,
} from "../../src";

/**
 * Example showing how to use the SNSTR library with NIP-07 browser extensions
 */
async function nip07Example() {
  // Update status to show exactly what we're checking
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

    client.on(RelayEvent.Disconnect, (relay) => {
      console.log(`Disconnected from ${relay}`);
    });

    // UI Elements - in a real application, these would be part of your UI framework
    const noteInput = document.getElementById(
      "note-input",
    ) as HTMLTextAreaElement;
    const publishButton = document.getElementById(
      "publish-button",
    ) as HTMLButtonElement;

    if (publishButton) {
      publishButton.addEventListener("click", async () => {
        if (!noteInput?.value) {
          statusDiv.textContent = "Please enter a note";
          return;
        }

        try {
          statusDiv.textContent = "Publishing note...";
          const note = await client.publishTextNote(noteInput.value);

          if (note) {
            statusDiv.textContent = `Note published! ID: ${note.id}`;
            noteInput.value = "";
          } else {
            statusDiv.textContent = "Failed to publish note";
          }
        } catch (error) {
          statusDiv.textContent = `Error: ${error}`;
        }
      });
    }

    // Subscribe to notes from our own pubkey
    const pubkeyToWatch = pubkey;
    client.subscribe(
      [{ kinds: [1], authors: [pubkeyToWatch], limit: 10 }],
      (event, relay) => {
        console.log(`Received note from ${relay}:`, event);
        // In a real app, you would update the UI with the notes
        const notesContainer = document.getElementById("notes");
        if (notesContainer) {
          const noteElement = document.createElement("div");
          noteElement.className = "note";
          noteElement.innerHTML = `
            <p><strong>From:</strong> ${event.pubkey}</p>
            <p><strong>Content:</strong> ${event.content}</p>
            <p><small>Received from ${relay}</small></p>
            <hr>
          `;
          notesContainer.prepend(noteElement);
        }
      },
    );

    // In a real app, you might want to clean up when the component unmounts
    // client.unsubscribe(subscriptionIds);
    // client.disconnectFromRelays();
  } catch (error) {
    console.error("Error in NIP-07 example:", error);
    if (statusDiv) {
      statusDiv.textContent = `Error: ${error}`;
      statusDiv.style.backgroundColor = "#ffebee";
    }
  }
}

// Call the example function when the page loads
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", nip07Example);
}

// Example HTML structure:
/*
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SNSTR NIP-07 Example</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    textarea {
      width: 100%;
      height: 100px;
      margin: 10px 0;
    }
    button {
      padding: 10px 15px;
      background-color: #1d9bf0;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .note {
      border: 1px solid #ccc;
      padding: 10px;
      margin: 10px 0;
      border-radius: 4px;
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
  <h1>SNSTR NIP-07 Example</h1>
  <div id="status">Checking for NIP-07 extension...</div>
  
  <h2>Publish a Note</h2>
  <textarea id="note-input" placeholder="Type your note content here..."></textarea>
  <button id="publish-button">Publish Note</button>
  
  <h2>Your Recent Notes</h2>
  <div id="notes"></div>
  
  <script src="browser.js"></script>
</body>
</html>
*/
