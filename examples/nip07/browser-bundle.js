// Simple Nostr client using NIP-07 browser extension
document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const noteInput = document.getElementById('note-input');
  const publishBtn = document.getElementById('publish-button');
  const notesContainer = document.getElementById('notes');
  const relayInput = document.getElementById('relay-input');
  let pubkey = '';
  let relayPool = [];

  // Connect to relays
  function connectToRelays() {
    const relayUrls = relayInput.value.split(',').map(r => r.trim()).filter(r => r);
    if (relayUrls.length === 0) return;
    
    statusEl.textContent = 'Connecting to relays...';
    
    // Close existing connections
    relayPool.forEach(r => r.close());
    relayPool = [];
    
    // Create new connections
    relayUrls.forEach(url => {
      try {
        const relay = new WebSocket(url);
        relay.url = url;
        
        relay.onopen = () => {
          statusEl.innerHTML += `<br>Connected to ${url}`;
          relay.connected = true;
        };
        
        relay.onclose = () => {
          relay.connected = false;
        };
        
        relay.onerror = () => {
          statusEl.innerHTML += `<br>Error connecting to ${url}`;
          relay.connected = false;
        };
        
        relayPool.push(relay);
      } catch (error) {
        statusEl.innerHTML += `<br>Failed to connect to ${url}: ${error.message}`;
      }
    });
  }
  
  // Publish event to connected relays
  function publishToRelays(event) {
    const connectedRelays = relayPool.filter(r => r.connected);
    if (connectedRelays.length === 0) {
      statusEl.innerHTML += '<br>No connected relays to publish to';
      return;
    }
    
    const message = JSON.stringify(["EVENT", event]);
    connectedRelays.forEach(relay => {
      try {
        relay.send(message);
        statusEl.innerHTML += `<br>Published to ${relay.url}`;
      } catch (error) {
        statusEl.innerHTML += `<br>Failed to publish to ${relay.url}: ${error.message}`;
      }
    });
  }

  // Check for NIP-07 extension
  if (!window.nostr) {
    statusEl.innerHTML = '<strong style="color: red">ERROR:</strong> No NIP-07 extension detected. Please install a Nostr browser extension.';
    return;
  }
  
  // Get public key from extension
  window.nostr.getPublicKey().then(key => {
    pubkey = key;
    statusEl.innerHTML = `<strong style="color: green">Connected!</strong> Public key: ${pubkey.substring(0, 10)}...`;
    
    // Connect to relays button
    const connectBtn = document.getElementById('connect-button');
    if (connectBtn) {
      connectBtn.addEventListener('click', connectToRelays);
    }
    
    // Set up publish button
    if (publishBtn) {
      publishBtn.addEventListener('click', async () => {
        if (!noteInput.value.trim()) {
          statusEl.textContent = 'Please enter a note';
          return;
        }
        
        try {
          statusEl.textContent = 'Signing note...';
          
          // Create unsigned event
          const event = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: noteInput.value
          };
          
          // Sign with extension
          const signedEvent = await window.nostr.signEvent(event);
          
          // Display and publish
          statusEl.innerHTML = `<strong style="color: green">Note signed!</strong> ID: ${signedEvent.id.substring(0, 10)}...`;
          
          // Add to notes container
          const noteElement = document.createElement('div');
          noteElement.className = 'note';
          noteElement.innerHTML = `
            <p><strong>Content:</strong> ${signedEvent.content}</p>
            <p><small>ID: ${signedEvent.id.substring(0, 10)}...</small></p>
          `;
          notesContainer.prepend(noteElement);
          
          // Publish to relays if connected
          if (relayPool.some(r => r.connected)) {
            publishToRelays(signedEvent);
          }
          
          noteInput.value = '';
        } catch (error) {
          statusEl.innerHTML = `<strong style="color: red">Error:</strong> ${error.message}`;
        }
      });
    }
  }).catch(error => {
    statusEl.innerHTML = `<strong style="color: red">ERROR:</strong> Failed to get public key: ${error.message}`;
  });
}); 