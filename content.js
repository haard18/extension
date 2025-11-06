/**
 * Content Script for AI Reply Generator
 * Detects posts on LinkedIn and X, injects "Generate Reply" buttons,
 * and handles the generation workflow.
 */

// Backend API endpoint
const API_ENDPOINT = "https://replier.elcarainternal.lol/generate";

/**
 * Detects which platform we're on (LinkedIn or X/Twitter)
 * @returns {string} 'linkedin' or 'x' or 'unknown'
 */
function detectPlatform() {
  const hostname = window.location.hostname;
  if (hostname.includes("linkedin")) return "linkedin";
  if (hostname.includes("x.com") || hostname.includes("twitter.com")) return "x";
  return "unknown";
}

/**
 * Extracts post text based on platform
 * LinkedIn: looks for post content in data containers
 * X: looks for tweet text in article elements
 * @param {HTMLElement} postElement - The post/tweet container
 * @returns {string} Extracted post text
 */
function extractPostText(postElement) {
  const platform = detectPlatform();

  if (platform === "linkedin") {
    // LinkedIn: Look for the post text in common selectors
    let textElement = postElement.querySelector(
      "[data-test-id='post-content'] span, .feed-item-text, [class*='feed']"
    );
    if (!textElement) {
      // Fallback: get all text content from the post
      textElement = postElement;
    }
    return textElement?.innerText || "";
  } else if (platform === "x") {
    // X/Twitter: Tweet text is typically in an article > div structure
    let textElement = postElement.querySelector("article div[lang]");
    if (!textElement) {
      // Fallback: try to find text in the article
      textElement = postElement.querySelector("article");
    }
    return textElement?.innerText || "";
  }

  return "";
}

/**
 * Creates a button element for generating replies
 * Neo-brutalist black circle with brain + icon
 * @returns {HTMLElement} The styled button element
 */
function createGenerateButton() {
  const button = document.createElement("button");
  button.className = "ai-reply-button";
  
  // Create SVG icon: brain with + symbol
  button.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5">
      <!-- Brain outline -->
      <path d="M12 2c-3.314 0-6 2.686-6 6 0 2 1 3.5 2 4.5-.5 1-1 2.5-1 4.5 0 3.314 2.686 6 6 6s6-2.686 6-6c0-2-.5-3.5-1-4.5 1-1 2-2.5 2-4.5 0-3.314-2.686-6-6-6z"/>
      <!-- Plus symbol -->
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  `;
  
  button.style.cssText = `
    width: 40px;
    height: 40px;
    padding: 0;
    background: #000000;
    color: #ffffff;
    border: 1px solid #000000;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    margin: 4px;
    flex-shrink: 0;
  `;

  button.addEventListener("mouseenter", () => {
    button.style.background = "#1a1a1a";
    button.style.boxShadow = "0 0 0 2px #000000";
    button.style.transform = "scale(1.1)";
  });

  button.addEventListener("mouseleave", () => {
    button.style.background = "#000000";
    button.style.boxShadow = "none";
    button.style.transform = "scale(1)";
  });

  return button;
}

/**
 * Generates a reply by calling the backend API
 * Routes to correct endpoint based on platform
 * Includes Clerk authentication token from extension storage
 * @param {string} postText - The original post text
 * @param {string} platform - 'linkedin' or 'x'
 * @returns {Promise<string>} The generated reply text
 */
async function generateReply(postText, platform) {
  try {
    // 1. Get the Clerk token from extension storage
    // Check if chrome.storage is available
    if (!chrome?.storage?.local) {
      throw new Error(
        'Chrome storage API not available. Please reload the page and try again.'
      );
    }

    const { clerkToken } = await new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(['clerkToken'], (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      } catch (err) {
        reject(err);
      }
    });

    if (!clerkToken) {
      throw new Error(
        'Authentication token not found. Please go to the dashboard and click "Send Token to Extension" first.'
      );
    }

    // 2. Choose endpoint based on platform
    const endpoint = platform === "x" 
      ? "https://replier.elcarainternal.lol/generate/twitter"
      : "https://replier.elcarainternal.lol/generate/linkedin";

    // 3. Make authenticated request to backend
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${clerkToken}`, // ✅ Include Clerk token
      },
      body: JSON.stringify({ text: postText }),
    });

    if (!response.ok) {
      // Check for specific error codes
      if (response.status === 401) {
        throw new Error('Authentication failed. Your token may have expired. Please send a new token from the dashboard.');
      } else if (response.status === 402) {
        throw new Error('Daily limit reached. Please upgrade your plan.');
      } else {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
    }

    const data = await response.text();
    return data;
  } catch (error) {
    console.error("Error generating reply:", error);
    throw error;
  }
}

/**
 * Fills the reply box with generated text based on platform
 * LinkedIn: Clicks the comment input and inserts text
 * X: Uses clipboard paste method for better React compatibility
 * @param {string} generatedText - The text to insert
 * @param {HTMLElement} postElement - The post/tweet element (for context)
 */
async function fillReplyBox(generatedText, postElement) {
  const platform = detectPlatform();

  if (platform === "linkedin") {
    // LinkedIn: Look for the comment input field CLOSEST to the post
    // First try to find one within or near the post element
    let commentBox = postElement.querySelector("[contenteditable='true'][role='textbox']");
    
    if (!commentBox) {
      // If not found in post, look for the nearest one in the DOM
      commentBox = document.querySelector("[contenteditable='true'][role='textbox']");
    }

    if (commentBox) {
      // Focus and set the text
      commentBox.focus();
      commentBox.innerText = generatedText;
      // Trigger input event to update the state
      commentBox.dispatchEvent(new Event("input", { bubbles: true }));
      commentBox.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      alert(
        "Could not find reply box. Please click in the comment field first."
      );
    }
  } else if (platform === "x") {
    // X/Twitter: Find the compose/reply input
    let tweetComposer = document.querySelector(
      "[data-testid='tweetTextarea_0'], [data-testid='tweetTextarea'], [contenteditable='true'][role='textbox']"
    );

    // If multiple text areas exist, try to find the one in focus
    if (!tweetComposer) {
      const allComposers = document.querySelectorAll("[contenteditable='true'][role='textbox']");
      if (allComposers.length > 0) {
        // Use the last one (usually most recent/active)
        tweetComposer = allComposers[allComposers.length - 1];
      }
    }

    if (tweetComposer) {
      try {
        // Method 1: Try using clipboard API (most compatible with React state)
        tweetComposer.focus();
        
        // Copy text to clipboard
        await navigator.clipboard.writeText(generatedText);
        
        // Trigger paste event
        const pasteEvent = new ClipboardEvent("paste", {
          clipboardData: new DataTransfer(),
          bubbles: true,
          cancelable: true,
        });
        pasteEvent.clipboardData?.setData("text/plain", generatedText);
        tweetComposer.dispatchEvent(pasteEvent);
        
        // Simulate Ctrl+V for maximum compatibility
        const keyDownEvent = new KeyboardEvent("keydown", {
          key: "v",
          code: "KeyV",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });
        tweetComposer.dispatchEvent(keyDownEvent);
        
        // Now dispatch input events
        setTimeout(() => {
          tweetComposer.dispatchEvent(new Event("input", { bubbles: true }));
          tweetComposer.dispatchEvent(new Event("change", { bubbles: true }));
        }, 50);
        
      } catch (clipboardError) {
        // Fallback: Direct text insertion if clipboard fails
        console.warn("Clipboard API failed, using fallback method:", clipboardError);
        
        tweetComposer.focus();
        tweetComposer.innerHTML = '';
        
        // Create proper text node
        const textNode = document.createTextNode(generatedText);
        tweetComposer.appendChild(textNode);
        
        // Dispatch events
        const events = [
          new Event("input", { bubbles: true }),
          new Event("change", { bubbles: true }),
          new KeyboardEvent("keydown", { bubbles: true, key: "a" }),
          new KeyboardEvent("keyup", { bubbles: true, key: "a" }),
        ];
        
        events.forEach(event => {
          tweetComposer.dispatchEvent(event);
        });
        
        // Set cursor position
        const range = document.createRange();
        range.selectNodeContents(tweetComposer);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    } else {
      alert(
        "Could not find reply box. Please click in the reply field first."
      );
    }
  }
}

/**
 * Attaches "Generate Reply" buttons to posts
 * Uses MutationObserver to handle dynamically loaded posts
 */
function attachButtonsToPosts() {
  const platform = detectPlatform();

  if (platform === "linkedin") {
    // LinkedIn: Multiple selectors to catch different post types
    // Try data attributes first, then class names, then generic containers
    const posts = document.querySelectorAll(
      "[data-test-id='post'], " +
      "[data-test-id='feed-item'], " +
      "[class*='artdeco-card'], " +
      "div[role='article'], " +
      "[class*='base-card']"
    );

    console.log(`[LinkedIn] Found ${posts.length} post elements`);

    posts.forEach((post, index) => {
      // Skip if button already exists
      if (post.querySelector(".ai-reply-button")) return;
      
      // Skip if this looks like a comment or reply (too small)
      if (post.offsetHeight < 100) return;

      const button = createGenerateButton();
      attachButtonClickHandler(button, post, platform);

      // Find where to place the button - look for interactions/actions area
      let insertPoint = post.querySelector(
        "[data-test-id='post-interactions'], " +
        "[class*='interactions'], " +
        "[class*='reactions']"
      );

      if (!insertPoint) {
        // Fallback: find the last div in the post that likely contains actions
        const children = post.querySelectorAll(":scope > div");
        insertPoint = children[children.length - 1];
      }

      if (insertPoint) {
        // Create a wrapper for our button
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "margin: 8px 0; display: flex; gap: 8px;";
        wrapper.appendChild(button);
        insertPoint.appendChild(wrapper);
      } else {
        post.appendChild(button);
      }
    });
  } else if (platform === "x") {
    // X/Twitter: Look for tweet containers
    // Modern X uses article elements with specific structure
    const tweets = document.querySelectorAll(
      "article, " +
      "[data-testid*='tweet'], " +
      "[role='article']"
    );

    console.log(`[X/Twitter] Found ${tweets.length} tweet elements`);

    tweets.forEach((tweet, index) => {
      // Skip if button already exists
      if (tweet.querySelector(".ai-reply-button")) return;

      // Make sure it's actually a tweet (has text content)
      const tweetText = tweet.innerText || "";
      if (tweetText.length < 10) return;

      const button = createGenerateButton();
      attachButtonClickHandler(button, tweet, platform);

      // Find the action buttons area
      let actionArea = tweet.querySelector(
        "[role='group'], " +
        "[data-testid='retweet'], " +
        "[class*='actions']"
      );

      if (actionArea && actionArea.parentElement) {
        // Insert button near actions
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "display: inline-block; margin-left: 8px;";
        wrapper.appendChild(button);
        actionArea.parentElement.insertBefore(wrapper, actionArea);
      } else {
        // Append directly to tweet
        tweet.appendChild(button);
      }
    });
  }
}

/**
 * Helper function to attach click handler to button
 * @param {HTMLElement} button - The button element
 * @param {HTMLElement} post - The post/tweet container
 * @param {string} platform - 'linkedin' or 'x'
 */
function attachButtonClickHandler(button, post, platform) {
  button.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    button.disabled = true;
    const originalOpacity = button.style.opacity;
    button.style.opacity = "0.6";

    try {
      const postText = extractPostText(post);
      if (!postText.trim()) {
        alert("Could not extract post text.");
        button.disabled = false;
        button.style.opacity = originalOpacity;
        return;
      }

      console.log(`[${platform}] Extracted text: "${postText.substring(0, 50)}..."`);

      // Pass platform to generateReply
      const reply = await generateReply(postText, platform);
      console.log(`[${platform}] Generated reply: "${reply.substring(0, 50)}..."`);

      // Pass the post element as context to fillReplyBox
      await fillReplyBox(reply, post);
      
      // Success flash
      button.style.background = "#000000";
      button.style.boxShadow = "0 0 0 3px #ffffff inset";
      setTimeout(() => {
        button.disabled = false;
        button.style.opacity = originalOpacity;
        button.style.boxShadow = "none";
      }, 1500);
    } catch (error) {
      console.error(`[${platform}] Error:`, error);
      alert(`Error: ${error.message}`);
      button.disabled = false;
      button.style.opacity = originalOpacity;
    }
  });
}

/**
 * Initialize: Run on page load and watch for new posts via MutationObserver
 */
function init() {
  const platform = detectPlatform();
  console.log(
    `[AI Reply Generator] Initialized on ${platform} (${window.location.hostname})`
  );

  // Initial scan after a small delay to let page render
  setTimeout(() => {
    console.log("[AI Reply Generator] Running initial scan...");
    attachButtonsToPosts();
  }, 500);

  // Watch for dynamically loaded posts (very common on LinkedIn and X)
  // Use a debounced approach to avoid performance issues
  let mutationTimeout;
  const observer = new MutationObserver(() => {
    clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
      attachButtonsToPosts();
    }, 300); // Wait 300ms after mutations stop before scanning
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false, // Don't watch attribute changes (performance)
  });

  // Periodic fallback scan every 2 seconds in case mutations are missed
  setInterval(() => {
    attachButtonsToPosts();
  }, 2000);

  console.log("[AI Reply Generator] ✅ Ready! Look for 🧠 Generate Reply buttons on posts");
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  // DOM already loaded
  init();
}

// Also listen for visibility changes (important for lazy-loaded content)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    console.log("[AI Reply Generator] Page became visible, rescanning...");
    attachButtonsToPosts();
  }
});
