/**
 * DEBUG HELPER - Run this in the browser console to test the extension
 * Open chrome://extensions/ -> Click the extension -> Inspect views: service worker
 * Or right-click on a post -> Inspect -> go to Console tab
 */

// Copy and paste this entire block into the browser console on LinkedIn or X

console.log("%c=== AI Reply Generator Debug ===", "color: #667eea; font-size: 16px; font-weight: bold");

// Test 1: Check if content script is loaded
console.log("1️⃣ Content script loaded:", typeof window.detectPlatform !== 'undefined');

// Test 2: Detect platform
const platform = document.location.hostname;
console.log("2️⃣ Platform detected:", platform);

// Test 3: Find posts on LinkedIn
if (platform.includes('linkedin')) {
  const linkedinSelectors = [
    "[data-test-id='post']",
    "[data-test-id='feed-item']",
    "[class*='artdeco-card']",
    "div[role='article']",
    "[class*='base-card']"
  ];
  
  linkedinSelectors.forEach(selector => {
    const count = document.querySelectorAll(selector).length;
    console.log(`   ${selector}: ${count} elements`);
  });
}

// Test 4: Find posts on X/Twitter
if (platform.includes('x.com') || platform.includes('twitter')) {
  const xSelectors = [
    "article",
    "[data-testid*='tweet']",
    "[role='article']"
  ];
  
  xSelectors.forEach(selector => {
    const count = document.querySelectorAll(selector).length;
    console.log(`   ${selector}: ${count} elements`);
  });
}

// Test 5: Check for existing buttons
const existingButtons = document.querySelectorAll(".ai-reply-button");
console.log("3️⃣ Existing AI Reply buttons:", existingButtons.length);

// Test 6: Test backend connection
console.log("4️⃣ Testing backend connection...");
fetch('http://localhost:3000/health')
  .then(r => r.json())
  .then(data => console.log("   ✅ Backend is running:", data))
  .catch(err => console.log("   ❌ Backend not running:", err.message));

// Test 7: Force button injection
console.log("5️⃣ Force injecting buttons...");
if (typeof attachButtonsToPosts !== 'undefined') {
  attachButtonsToPosts();
  console.log("   ✅ Injection triggered");
} else {
  console.log("   ❌ attachButtonsToPosts not defined");
}

console.log("%c=== Debug Complete ===", "color: #667eea; font-size: 14px");
