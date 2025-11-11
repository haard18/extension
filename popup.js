/**
 * Extension Popup Script
 * Handles UI interactions, tone selection, quota tracking, and authentication
 */

const DASHBOARD_URL = "https://replydash.app/dashboard";
const BACKEND_URL = "https://replier.elcarainternal.lol";
const QUOTA_POLL_INTERVAL = 15000; // 15 seconds

let quotaPollTimer = null;

/**
 * Initialize the popup on load
 */
async function initPopup() {
  console.log("📱 Popup initializing...");
  await checkAuthStatus();
  setupToneToggle();
  startQuotaPolling();
  console.log("✅ Popup initialized");
}

/**
 * Setup tone toggle buttons and emoji toggle
 */
function setupToneToggle() {
  const toneValueBtn = document.getElementById("toneValue");
  const toneFunnyBtn = document.getElementById("toneFunny");
  const emojiToggle = document.getElementById("emojiToggle");

  toneValueBtn.addEventListener("click", () => setTone("value", toneValueBtn, toneFunnyBtn));
  toneFunnyBtn.addEventListener("click", () => setTone("funny", toneFunnyBtn, toneValueBtn));

  // Setup emoji toggle
  if (emojiToggle) {
    emojiToggle.addEventListener("change", (e) => {
      chrome.storage.local.set({ enableEmojis: e.target.checked }, () => {
        console.log(`✅ Emojis ${e.target.checked ? 'enabled' : 'disabled'}`);
      });
    });

    // Load saved emoji preference
    chrome.storage.local.get(["enableEmojis"], (result) => {
      const enableEmojis = result.enableEmojis !== undefined ? result.enableEmojis : true;
      emojiToggle.checked = enableEmojis;
    });
  }

  // Load saved tone preference
  chrome.storage.local.get(["replyTone"], (result) => {
    const savedTone = result.replyTone || "value";
    if (savedTone === "funny") {
      toneFunnyBtn.click();
    }
  });
}

/**
 * Set the reply tone and update UI
 */
function setTone(tone, activeBtn, inactiveBtn) {
  chrome.storage.local.set({ replyTone: tone }, () => {
    activeBtn.classList.add("active");
    inactiveBtn.classList.remove("active");
    console.log(`✅ Tone set to: ${tone}`);
  });
}

/**
 * Check authentication status and display appropriate UI
 */
async function checkAuthStatus() {
  try {
    // Ensure DOM is ready
    if (!document.getElementById("authSection")) {
      console.warn("⚠️ DOM not ready yet, waiting...");
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const data = await new Promise((resolve) => {
      chrome.storage.local.get(["clerkToken", "clerkTokenTimestamp"], resolve);
    });

    console.log("🔍 Checking auth status. Token exists:", !!data.clerkToken);

    const authSection = document.getElementById("authSection");
    const statusSection = document.getElementById("statusSection");
    const quotaDisplay = document.getElementById("quotaDisplay");
    const toneSection = document.getElementById("toneSection");
    const emojiSection = document.getElementById("emojiSection");
    const infoSection = document.getElementById("infoSection");
    const statusText = document.getElementById("statusText");
    const statusDot = document.getElementById("statusDot");
    const authButton = document.getElementById("authButton");

    // Verify elements exist before proceeding
    if (!authSection || !statusText || !statusDot) {
      console.error("❌ Required DOM elements not found");
      return;
    }

    if (data.clerkToken) {
      // Token exists - show authenticated UI
      try {
        console.log("📋 Token found. Validating...");
        const tokenParts = data.clerkToken.split(".");
        
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log("✅ Token decoded successfully. Payload:", payload);
          
          // Check expiry if available
          if (payload.exp) {
            const expiryDate = new Date(payload.exp * 1000);
            const now = new Date();
            console.log("⏰ Token expiry:", expiryDate, "Now:", now);
            
            if (expiryDate <= now) {
              console.warn("⚠️ Token has expired");
              throw new Error("Token expired");
            }
          }
          
          // Token is valid - show authenticated UI
          console.log("🎉 Token valid! Showing authenticated UI");
          authSection.classList.add("hidden");
          if (quotaDisplay) quotaDisplay.classList.remove("hidden");
          if (toneSection) toneSection.classList.remove("hidden");
          if (emojiSection) emojiSection.classList.remove("hidden");
          if (infoSection) infoSection.classList.remove("hidden");
          statusText.textContent = "Connected ✓";
          statusDot.classList.remove("inactive");
          
          // Fetch current usage
          await fetchAndDisplayUsage(data.clerkToken);
          return;
        } else {
          console.warn("❌ Token format invalid. Parts:", tokenParts.length);
        }
      } catch (e) {
        console.warn("⚠️ Error validating token:", e);
        // Even if validation fails, if token exists, treat as authenticated
        // (backend will handle actual validation)
        console.log("💡 Token exists even if validation failed. Showing authenticated UI");
        authSection.classList.add("hidden");
        if (quotaDisplay) quotaDisplay.classList.remove("hidden");
        if (toneSection) toneSection.classList.remove("hidden");
        if (emojiSection) emojiSection.classList.remove("hidden");
        if (infoSection) infoSection.classList.remove("hidden");
        statusText.textContent = "Connected ✓";
        statusDot.classList.remove("inactive");
        
        // Try to fetch usage anyway
        try {
          await fetchAndDisplayUsage(data.clerkToken);
        } catch (usageError) {
          console.warn("Could not fetch usage:", usageError);
        }
        return;
      }
    }

    // Not authenticated
    console.log("❌ No token found. Showing login prompt");
    authSection.classList.remove("hidden");
    if (quotaDisplay) quotaDisplay.classList.add("hidden");
    if (toneSection) toneSection.classList.add("hidden");
    if (emojiSection) emojiSection.classList.add("hidden");
    if (infoSection) infoSection.classList.add("hidden");
    statusText.textContent = "Not connected";
    statusDot.classList.add("inactive");
    if (authButton) authButton.textContent = "🔐 Connect Account";
  } catch (error) {
    console.error("Error checking auth status:", error);
  }
}

/**
 * Fetch current usage from backend and display in UI
 */
async function fetchAndDisplayUsage(token) {
  try {
    console.log("📊 Fetching usage data...");
    const response = await fetch(`${BACKEND_URL}/usage`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ Usage fetch returned status ${response.status}`);
      if (response.status === 401) {
        console.warn("🔐 Unauthorized - token may be invalid");
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const usage = await response.json();
    console.log("✅ Usage data received:", usage);
    updateQuotaDisplay(usage);
  } catch (error) {
    console.warn("⚠️ Error fetching usage:", error);
    // Continue without quota data - UI will show "Loading usage data..."
  }
}

/**
 * Update quota display in UI
 */
function updateQuotaDisplay(usage) {
  if (!usage) return;

  document.getElementById("dailyUsed").textContent = usage.daily_used || 0;
  document.getElementById("dailyGoal").textContent = usage.daily_goal || 10;
  document.getElementById("weeklyUsed").textContent = usage.weekly_used || 0;
  document.getElementById("weeklyGoal").textContent = usage.weekly_goal || 50;

  // Update progress bars
  const dailyPercent = Math.min(100, ((usage.daily_used || 0) / (usage.daily_goal || 1)) * 100);
  const weeklyPercent = Math.min(100, ((usage.weekly_used || 0) / (usage.weekly_goal || 1)) * 100);

  const dailyBar = document.getElementById("dailyBar");
  const weeklyBar = document.getElementById("weeklyBar");

  dailyBar.style.width = `${dailyPercent}%`;
  weeklyBar.style.width = `${weeklyPercent}%`;

  // Add warning class if over 80%
  if (dailyPercent > 80) {
    dailyBar.classList.add("warning");
  } else {
    dailyBar.classList.remove("warning");
  }

  if (weeklyPercent > 80) {
    weeklyBar.classList.add("warning");
  } else {
    weeklyBar.classList.remove("warning");
  }
}

/**
 * Start polling for quota updates
 */
function startQuotaPolling() {
  chrome.storage.local.get(["clerkToken"], (result) => {
    if (result.clerkToken) {
      // Poll every 15 seconds
      quotaPollTimer = setInterval(async () => {
        chrome.storage.local.get(["clerkToken"], async (data) => {
          if (data.clerkToken) {
            await fetchAndDisplayUsage(data.clerkToken);
          }
        });
      }, QUOTA_POLL_INTERVAL);
    }
  });
}

/**
 * Stop polling for quota updates
 */
function stopQuotaPolling() {
  if (quotaPollTimer) {
    clearInterval(quotaPollTimer);
    quotaPollTimer = null;
  }
}

/**
 * Open dashboard to send token
 */
function openDashboard() {
  chrome.tabs.create({ url: DASHBOARD_URL });
}

// Event listeners
document.getElementById("authButton").addEventListener("click", openDashboard);

// Listen for storage changes (when dashboard sends token or settings change)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.clerkToken || changes.replyTone || changes.enableEmojis)) {
    checkAuthStatus();
  }
});

// Clean up when popup closes
window.addEventListener("unload", () => {
  stopQuotaPolling();
});

// Initialize when popup loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPopup);
} else {
  initPopup();
}

