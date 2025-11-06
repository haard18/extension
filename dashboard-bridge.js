/**
 * Dashboard Bridge Script
 * 
 * This content script runs on the Replier dashboard and provides
 * a bridge between the web page and the extension's storage API.
 * 
 * It listens for custom events from the dashboard and stores tokens
 * in chrome.storage.local
 */

console.log("🌉 Dashboard bridge script loaded");

// Listen for token storage requests from the dashboard page
window.addEventListener('message', (event) => {
  // Only accept messages from the same origin
  if (event.origin !== window.location.origin) {
    console.warn("⚠️ Rejected message from different origin:", event.origin);
    return;
  }

  const { type, action, token } = event.data;

  // Check if this is a replier message
  if (type !== 'REPLIER_EXTENSION') {
    return;
  }

  console.log("📨 Received message from dashboard:", { action, hasToken: !!token });

  if (action === 'STORE_TOKEN' && token) {
    console.log("💾 Storing token...", {
      tokenLength: token.length,
      tokenPreview: token.substring(0, 30) + "..."
    });

    // Store in chrome.storage.local
    chrome.storage.local.set({
      clerkToken: token,
      clerkTokenTimestamp: new Date().toISOString(),
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("❌ Error storing token:", chrome.runtime.lastError);
        
        // Send error back to page
        const errorMsg = {
          type: 'REPLIER_EXTENSION_RESPONSE',
          success: false,
          error: chrome.runtime.lastError.message
        };
        console.log("📤 Sending error response:", errorMsg);
        window.postMessage(errorMsg, window.location.origin);
        return;
      }

      console.log("✅ Token stored successfully!");

      // Verify storage
      chrome.storage.local.get(['clerkToken', 'clerkTokenTimestamp'], (data) => {
        console.log("📦 Verification:", {
          hasToken: !!data.clerkToken,
          tokenLength: data.clerkToken?.length,
          timestamp: data.clerkTokenTimestamp
        });

        // Send success response back to page
        const successMsg = {
          type: 'REPLIER_EXTENSION_RESPONSE',
          success: true,
          data: {
            tokenLength: data.clerkToken?.length,
            timestamp: data.clerkTokenTimestamp
          }
        };
        console.log("📤 Sending success response:", successMsg);
        window.postMessage(successMsg, window.location.origin);
      });
    });
  } else if (action === 'CHECK_TOKEN') {
    // Check if token exists
    chrome.storage.local.get(['clerkToken', 'clerkTokenTimestamp'], (data) => {
      console.log("🔍 Token check:", {
        hasToken: !!data.clerkToken,
        timestamp: data.clerkTokenTimestamp
      });

      window.postMessage({
        type: 'REPLIER_EXTENSION_RESPONSE',
        success: true,
        hasToken: !!data.clerkToken,
        timestamp: data.clerkTokenTimestamp
      }, window.location.origin);
    });
  }
});

// Send ready signal to the page
window.postMessage({
  type: 'REPLIER_EXTENSION_READY'
}, window.location.origin);

console.log("✅ Dashboard bridge ready and listening for messages");
