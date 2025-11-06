/**
 * Background Service Worker
 * Handles extension lifecycle and messaging
 */

// Listen for extension install or update
chrome.runtime.onInstalled.addListener(() => {
  console.log("[AI Reply Generator] Extension installed or updated");
  
  // Check if token exists on install
  chrome.storage.local.get(['clerkToken', 'clerkTokenTimestamp'], (data) => {
    if (data.clerkToken) {
      console.log("📦 Existing token found on install:", {
        hasToken: true,
        timestamp: data.clerkTokenTimestamp,
        tokenPreview: data.clerkToken?.substring(0, 30) + "..."
      });
    } else {
      console.log("📦 No existing token found");
    }
  });
});

// Helper function to check storage (can be called from console)
// Usage: Just type "checkStorage()" in the service worker console
globalThis.checkStorage = function() {
  chrome.storage.local.get(null, (data) => {
    console.log("=== COMPLETE STORAGE DUMP ===");
    console.log("All data:", data);
    console.log("Keys:", Object.keys(data));
    console.log("Has clerkToken:", !!data.clerkToken);
    if (data.clerkToken) {
      console.log("Token preview:", data.clerkToken.substring(0, 50) + "...");
      console.log("Token length:", data.clerkToken.length);
    }
    console.log("Timestamp:", data.clerkTokenTimestamp);
    console.log("========================");
  });
};

// Log on startup
console.log("🚀 Background service worker started!");
console.log("💡 Tip: Type 'checkStorage()' in this console to view stored data");


// Handle messages from content scripts, popup, or web pages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generateReply") {
    // This can be used for additional background processing if needed
    sendResponse({ status: "Processing..." });
  }
});

// Listen for messages from external web pages (dashboard)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log("=== EXTERNAL MESSAGE RECEIVED ===");
  console.log("Sender:", sender);
  console.log("Request:", request);
  console.log("Action:", request?.action);
  console.log("Token preview:", request?.token?.substring(0, 20) + "...");
  
  if (request.action === "storeToken" && request.token) {
    console.log("📥 Storing token in chrome.storage.local...");
    
    // Store the token in chrome.storage.local
    chrome.storage.local.set({
      clerkToken: request.token,
      clerkTokenTimestamp: new Date().toISOString(),
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("❌ Error storing token:", chrome.runtime.lastError);
        sendResponse({ success: false, message: chrome.runtime.lastError.message });
        return;
      }
      
      console.log("✅ Token stored successfully!");
      
      // Verify it was stored by reading it back
      chrome.storage.local.get(['clerkToken', 'clerkTokenTimestamp'], (data) => {
        console.log("📦 Verification - Storage contents:", {
          hasToken: !!data.clerkToken,
          tokenLength: data.clerkToken?.length,
          timestamp: data.clerkTokenTimestamp,
          tokenPreview: data.clerkToken?.substring(0, 30) + "..."
        });
      });
      
      sendResponse({ success: true, message: "Token stored successfully" });
    });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
  
  console.warn("⚠️ Unknown action or missing token");
  sendResponse({ success: false, message: "Unknown action" });
});
