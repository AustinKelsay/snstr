// Simple Nostr DM client using NIP-07 browser extension
document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const recipientInput = document.getElementById('recipient-input');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-button');
  const messagesContainer = document.getElementById('messages');
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
    
    // Set up send button
    if (sendBtn) {
      sendBtn.addEventListener('click', async () => {
        if (!recipientInput.value.trim()) {
          statusEl.textContent = 'Please enter a recipient public key';
          return;
        }
        
        if (!messageInput.value.trim()) {
          statusEl.textContent = 'Please enter a message';
          return;
        }
        
        try {
          statusEl.textContent = 'Encrypting message...';
          
          const recipientPubkey = recipientInput.value.trim();
          const messageContent = messageInput.value;
          
          // Try NIP-44 first, fall back to NIP-04
          let encryptedContent;
          const hasNip44 = window.nostr.nip44 && typeof window.nostr.nip44.encrypt === 'function';
          const hasNip04 = window.nostr.nip04 && typeof window.nostr.nip04.encrypt === 'function';
          
          if (!hasNip44 && !hasNip04) {
            throw new Error('Your extension does not support encryption');
          }
          
          try {
            if (hasNip44) {
              encryptedContent = await window.nostr.nip44.encrypt(recipientPubkey, messageContent);
              statusEl.innerHTML += '<br>Using NIP-44 encryption';
            } else {
              encryptedContent = await window.nostr.nip04.encrypt(recipientPubkey, messageContent);
              statusEl.innerHTML += '<br>Using NIP-04 encryption';
            }
          } catch (e) {
            if (hasNip04) {
              encryptedContent = await window.nostr.nip04.encrypt(recipientPubkey, messageContent);
              statusEl.innerHTML += '<br>Fallback to NIP-04 encryption';
            } else {
              throw new Error('Encryption failed');
            }
          }
          
          // Create the DM event
          const event = {
            kind: 4,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', recipientPubkey]],
            content: encryptedContent
          };
          
          // Sign with extension
          const signedEvent = await window.nostr.signEvent(event);
          
          // Display and publish
          statusEl.innerHTML = `<strong style="color: green">Message signed!</strong> ID: ${signedEvent.id.substring(0, 10)}...`;
          
          // Add to messages container
          const messageElement = document.createElement('div');
          messageElement.className = 'message sent';
          messageElement.innerHTML = `
            <p><strong>To:</strong> ${recipientPubkey.substring(0, 10)}...</p>
            <p>${messageContent}</p>
            <p><small>${new Date().toLocaleTimeString()}</small></p>
          `;
          messagesContainer.appendChild(messageElement);
          
          // Publish to relays if connected
          if (relayPool.some(r => r.connected)) {
            publishToRelays(signedEvent);
          }
          
          // Clear the message input
          messageInput.value = '';
          
        } catch (error) {
          statusEl.innerHTML = `<strong style="color: red">Error:</strong> ${error.message}`;
        }
      });
    }
  }).catch(error => {
    statusEl.innerHTML = `<strong style="color: red">ERROR:</strong> Failed to get public key: ${error.message}`;
  });
}); 