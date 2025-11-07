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
  checkAuthStatus();
  setupToneToggle();
  startQuotaPolling();
}

/**
 * Setup tone toggle buttons
 */
function setupToneToggle() {
  const toneValueBtn = document.getElementById("toneValue");
  const toneFunnyBtn = document.getElementById("toneFunny");

  toneValueBtn.addEventListener("click", () => setTone("value", toneValueBtn, toneFunnyBtn));
  toneFunnyBtn.addEventListener("click", () => setTone("funny", toneFunnyBtn, toneValueBtn));

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
    const data = await new Promise((resolve) => {
      chrome.storage.local.get(["clerkToken", "clerkTokenTimestamp"], resolve);
    });

    const authSection = document.getElementById("authSection");
    const statusSection = document.getElementById("statusSection");
    const quotaDisplay = document.getElementById("quotaDisplay");
    const toneSection = document.getElementById("toneSection");
    const infoSection = document.getElementById("infoSection");
    const statusText = document.getElementById("statusText");
    const statusDot = document.getElementById("statusDot");
    const authButton = document.getElementById("authButton");

    if (data.clerkToken) {
      // Check if token is valid
      try {
        const tokenParts = data.clerkToken.split(".");
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          const expiryDate = new Date(payload.exp * 1000);
          const now = new Date();

          if (expiryDate > now) {
            // Token is valid - show authenticated UI
            authSection.classList.add("hidden");
            quotaDisplay.classList.remove("hidden");
            toneSection.classList.remove("hidden");
            infoSection.classList.remove("hidden");
            statusText.textContent = "Connected ✓";
            statusDot.classList.remove("inactive");
            
            // Fetch current usage
            await fetchAndDisplayUsage(data.clerkToken);
            return;
          }
        }
      } catch (e) {
        console.warn("Error decoding token:", e);
      }
    }

    // Not authenticated or token expired
    authSection.classList.remove("hidden");
    quotaDisplay.classList.add("hidden");
    toneSection.classList.add("hidden");
    infoSection.classList.add("hidden");
    statusText.textContent = "Not connected";
    statusDot.classList.add("inactive");
    authButton.textContent = "🔐 Connect Account";
  } catch (error) {
    console.error("Error checking auth status:", error);
  }
}

/**
 * Fetch current usage from backend and display in UI
 */
async function fetchAndDisplayUsage(token) {
  try {
    const response = await fetch(`${BACKEND_URL}/usage`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const usage = await response.json();
    updateQuotaDisplay(usage);
  } catch (error) {
    console.warn("Error fetching usage:", error);
    // Continue without quota data
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

// Listen for storage changes (when dashboard sends token)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.clerkToken || changes.replyTone)) {
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

