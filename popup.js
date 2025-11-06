/**
 * Popup Script
 * Handles popup UI interactions and authentication status
 */

// Dashboard URL where users can send their token
const DASHBOARD_URL = "https://replydash.app/dashboard";

/**
 * Check if user has a valid authentication token
 */
async function checkAuthStatus() {
  try {
    const data = await new Promise((resolve) => {
      chrome.storage.local.get(['clerkToken', 'clerkTokenTimestamp'], resolve);
    });

    const authIndicator = document.getElementById('authStatusIndicator');
    const authStatusText = document.getElementById('authStatusText');
    const authMessage = document.getElementById('authMessage');
    const userInfo = document.getElementById('userInfo');
    const tokenExpires = document.getElementById('tokenExpires');
    const authButton = document.getElementById('authButton');

    if (data.clerkToken) {
      // Token exists - check if it's still valid (decode JWT)
      try {
        const tokenParts = data.clerkToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          const expiryDate = new Date(payload.exp * 1000);
          const now = new Date();

          if (expiryDate > now) {
            // Token is valid
            authIndicator.classList.add('authenticated');
            authStatusText.textContent = 'Authenticated ✓';
            authMessage.textContent = 'Your extension is connected to Replier and ready to use!';
            userInfo.style.display = 'block';
            tokenExpires.textContent = expiryDate.toLocaleString();
            authButton.textContent = '🔄 Refresh Token';
            return;
          }
        }
      } catch (e) {
        console.warn('Error decoding token:', e);
      }
    }

    // No token or token is expired
    authIndicator.classList.remove('authenticated');
    authStatusText.textContent = 'Not authenticated';
    authMessage.innerHTML = 'Go to your <a href="#" id="dashboardLink">dashboard</a> and click "Send Token to Extension" to connect.';
    userInfo.style.display = 'none';
    authButton.textContent = '🔐 Authenticate';

    // Add click handler for dashboard link
    const dashboardLink = document.getElementById('dashboardLink');
    if (dashboardLink) {
      dashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: DASHBOARD_URL });
      });
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
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

document.getElementById("openSettings").addEventListener("click", () => {
  alert("Settings page coming soon!");
});

document.getElementById("openDocs").addEventListener("click", () => {
  alert(
    "Documentation:\n\n" +
      "1. Click '🔐 Authenticate' to connect your Replier account\n" +
      "2. Visit LinkedIn or X\n" +
      "3. Look for '🧠 Generate Reply' buttons under posts\n" +
      "4. Click to generate a reply\n" +
      "5. The reply will be auto-filled in the comment box"
  );
});

// Check backend status
async function checkBackendStatus() {
  try {
    const response = await fetch("https://replier.elcarainternal.lol/health", {
      method: "GET",
    });
    if (response.ok) {
      console.log("✅ Backend is running");
    }
  } catch (error) {
    console.warn(
      "⚠️ Backend might not be running. Make sure to start it with: npm start"
    );
  }
}

// Initialize
checkBackendStatus();
checkAuthStatus();

// Listen for storage changes (when dashboard sends token)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.clerkToken) {
    checkAuthStatus();
  }
});

