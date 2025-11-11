/**
 * Content Script for AI Reply Generator
 * Detects posts on LinkedIn and X, injects "Generate Reply" buttons,
 * and handles the generation workflow with loading states.
 */

// Backend API endpoint
const API_ENDPOINT = "https://replier.elcarainternal.lol/generate";

// Track posts that already have buttons to avoid duplicates
const processedPosts = new WeakSet();

/**
 * Detects which platform we're on (LinkedIn or X/Twitter)
 * @returns {string} 'linkedin' or 'x' or 'unknown'
 */
function detectPlatform() {
  const hostname = window.location.hostname;
  if (hostname.includes("linkedin")) return "linkedin";
  if (hostname.includes("x.com") || hostname.includes("twitter.com"))
    return "x";
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
  if (!postElement) return "";

  const platform = detectPlatform();

  if (platform === "linkedin") {
    // LinkedIn: Look for the post text in common selectors
    let textElement = postElement.querySelector(
      "[data-test-id='post-content'] span, .feed-shared-update-v2__description, .feed-item-text, [class*='feed']"
    );
    if (!textElement) {
      // Fallback: get all text content from the post
      textElement = postElement;
    }
    return textElement?.innerText || "";
  } else if (platform === "x") {
    // X/Twitter: Tweet text is typically in an article > div structure
    let textElement = postElement.querySelector(
      "article div[lang], [data-testid='tweetText']"
    );
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
 * @returns {HTMLElement} The styled button container
 */
function createGenerateButton() {
  const container = document.createElement("div");
  container.className = "ai-reply-button-container";
  container.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin: 0;
    padding: 0;
  `;

  const button = document.createElement("button");
  button.className = "ai-reply-button";
  button.title = "Generate AI Reply";

  button.innerHTML = `
  <svg class="icon" xmlns="http://www.w3.org/2000/svg"
       width="20" height="20" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"></circle>
    <path d="M13 6l-5 6h4l-1 6 5-6h-4z"></path>
  </svg>
  <div class="spinner hidden" style="display: none; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #ffffff; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
`;

  button.style.cssText = `
    width: 40px;
    height: 40px;
    padding: 0;
    background: #000000;
    color: #ffffff;
    border: 2px solid #000000;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
    position: relative;
  `;

  // Status text
  const statusText = document.createElement("span");
  statusText.className = "ai-status-text";
  statusText.style.cssText = `
    font-size: 13px;
    color: #666;
    font-weight: 500;
    white-space: nowrap;
    margin-right: 8px;
  `;

  button.addEventListener("mouseenter", () => {
    if (!button.disabled) {
      button.style.background = "#1a1a1a";
      button.style.boxShadow = "0 0 0 3px rgba(0, 0, 0, 0.1)";
      button.style.transform = "scale(1.05)";
    }
  });

  button.addEventListener("mouseleave", () => {
    if (!button.disabled) {
      button.style.background = "#000000";
      button.style.boxShadow = "none";
      button.style.transform = "scale(1)";
    }
  });

  container.appendChild(statusText);
  container.appendChild(button);

  return container;
}

/**
 * Generates a reply by calling the backend API
 * Routes to correct endpoint based on platform
 * Includes Clerk authentication token from extension storage
 * Includes tone preference (funny or value)
 * @param {string} postText - The original post text
 * @param {string} platform - 'linkedin' or 'x'
 * @returns {Promise<object>} The generated reply and usage stats
 */
async function generateReply(postText, platform) {
  try {
    // 1. Get the Clerk token, tone preference, and emoji setting from extension storage
    if (!chrome?.storage?.local) {
      throw new Error(
        "Chrome storage API not available. Please reload the page and try again."
      );
    }
    const { clerkToken, replyTone, enableEmojis } = await new Promise(
      (resolve, reject) => {
        try {
          chrome.storage.local.get(
            ["clerkToken", "replyTone", "enableEmojis"],
            (result) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(result);
              }
            }
          );
        } catch (err) {
          reject(err);
        }
      }
    );

    if (!clerkToken) {
      throw new Error(
        'Authentication token not found. Please go to the dashboard and click "Send Token to Extension" first.'
      );
    }

    // 2. Choose endpoint based on platform
    const endpoint =
      platform === "x"
        ? "https://replier.elcarainternal.lol/generate/twitter"
        : "https://replier.elcarainternal.lol/generate/linkedin";

    // Determine default tone based on platform (funny for X, value for LinkedIn)
    const tone = replyTone || (platform === "x" ? "funny" : "value");

    // Default emoji setting to true if not set
    const includeEmojis = enableEmojis !== undefined ? enableEmojis : true;

    console.log(
      `[${platform}] Generating reply with tone: ${tone}, emojis: ${includeEmojis}`
    );

    // 3. Make authenticated request to backend with tone and emoji preference
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clerkToken}`, // ✅ Include Clerk token
      },
      body: JSON.stringify({
        text: postText,
        tone: tone,
        emojiBool: includeEmojis,
      }),
    });

    if (!response.ok) {
      // Check for specific error codes
      if (response.status === 401) {
        throw new Error(
          "Authentication failed. Your token may have expired. Please send a new token from the dashboard."
        );
      } else if (response.status === 402) {
        throw new Error("Daily limit reached. Please upgrade your plan.");
      } else {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
    }

    // Parse JSON response with reply and usage stats
    const data = await response.json();
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
    // LinkedIn: Find the comment input field closest to the post
    let commentBox = postElement?.querySelector(
      "[contenteditable='true'][role='textbox']"
    );
    if (!commentBox) {
      commentBox = document.querySelector(
        "[contenteditable='true'][role='textbox']"
      );
    }

    if (commentBox) {
      commentBox.focus();
      commentBox.innerText = generatedText;
      commentBox.dispatchEvent(new Event("input", { bubbles: true }));
      commentBox.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      alert("Could not find LinkedIn comment box. Please click in it first.");
    }
  } else if (platform === "x") {
    // X (Twitter)
    let replyBox = document.querySelector(
      "[data-testid='tweetTextarea_0'], [data-testid='tweetTextarea'], [contenteditable='true'][role='textbox']"
    );

    if (!replyBox) {
      const allComposers = document.querySelectorAll(
        "[contenteditable='true'][role='textbox']"
      );
      if (allComposers.length > 0)
        replyBox = allComposers[allComposers.length - 1];
    }

    if (replyBox) {
      replyBox.focus();
      await new Promise((resolve) => setTimeout(resolve, 50));

      try {
        // Simulate a paste event with a DataTransfer object
        const dataTransfer = new DataTransfer();
        dataTransfer.setData("text/plain", generatedText);

        const pasteEvent = new ClipboardEvent("paste", {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true,
        });

        replyBox.dispatchEvent(pasteEvent);

        // Ensure cursor is at end
        const range = document.createRange();
        range.selectNodeContents(replyBox);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);

        // Optional: small tweak to ensure React detects it
        replyBox.dispatchEvent(new InputEvent("input", { bubbles: true }));
      } catch (err) {
        console.warn("Paste simulation failed, falling back:", err);

        // Fallback: simulate typing character-by-character
        for (const char of generatedText) {
          const inputEvent = new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: char,
          });
          replyBox.dispatchEvent(inputEvent);
        }
      }
    } else {
      alert("Could not find reply box. Please click in the reply field first.");
    }
  }
}

/**
 * Detects if we're viewing a tweet in detail/expanded view (not on feed)
 * @returns {boolean} true if viewing detail/conversation view
 */
function isTwitterDetailView() {
  // Check if we're on a detail page (URL contains /status/ or /i/web/status/)
  const url = window.location.href;
  if (url.includes("/status/") || url.includes("/i/web/status/")) {
    return true;
  }

  // Additional check: look for conversation/detail view indicators
  // In detail view, there's usually a larger tweet display and conversation thread
  const mainArticles = document.querySelectorAll(
    "article[data-testid='tweet']"
  );

  // If there's only 1 article and it takes up significant screen space, likely detail view
  if (mainArticles.length === 1) {
    const article = mainArticles[0];
    const rect = article.getBoundingClientRect();
    // Check if tweet takes up more than 30% of viewport height (detail view indicator)
    if (rect.height > window.innerHeight * 0.3) {
      return true;
    }
  }

  return false;
}

/**
 * Attaches "Generate Reply" buttons to posts
 * Uses MutationObserver to handle dynamically loaded posts
 */
function attachButtonsToPosts() {
  const platform = detectPlatform();

  if (platform === "linkedin") {
    // LinkedIn: Multiple selectors to catch different post types
    const posts = document.querySelectorAll(
      "[data-test-id='post'], " +
        "[data-test-id='feed-item'], " +
        "[class*='artdeco-card'], " +
        "div[role='article'], " +
        "[class*='base-card']"
    );

    posts.forEach((post) => {
      // Double-check: Skip if already has our button
      if (
        processedPosts.has(post) ||
        post.querySelector(".ai-reply-button-container")
      )
        return;

      // Skip if this looks like a comment or reply (too small)
      if (post.offsetHeight < 100) return;

      // Mark as processed BEFORE adding button
      processedPosts.add(post);

      const buttonContainer = createGenerateButton();
      const button = buttonContainer.querySelector(".ai-reply-button");
      const statusText = buttonContainer.querySelector(".ai-status-text");
      const icon = button.querySelector(".icon");
      const spinner = button.querySelector(".spinner");

      // Add click handler
      attachButtonClickHandler(
        button,
        buttonContainer,
        statusText,
        icon,
        spinner,
        post,
        platform
      );

      // Find where to place the button - look for interactions/actions area
      let insertPoint = post.querySelector(
        "[data-test-id='post-interactions'], " +
          "[class*='interactions'], " +
          "[class*='social-actions']"
      );

      if (!insertPoint) {
        // Fallback: find the last div in the post that likely contains actions
        const children = post.querySelectorAll(":scope > div");
        insertPoint = children[children.length - 1];
      }

      if (insertPoint) {
        insertPoint.appendChild(buttonContainer);
      } else {
        post.appendChild(buttonContainer);
      }
    });
  } else if (platform === "x") {
    // X/Twitter: Only show button in detail/expanded view, not on feed
    // Check if we're in detail view
    if (!isTwitterDetailView()) {
      console.log("[X] Feed view detected - skipping button injection");
      return;
    }

    console.log("[X] Detail view detected - injecting buttons");

    // X/Twitter: Look for tweet containers - use more specific selector
    const tweets = document.querySelectorAll("article[data-testid='tweet']");

    tweets.forEach((tweet) => {
      // Double-check: Skip if already has our button
      if (
        processedPosts.has(tweet) ||
        tweet.querySelector(".ai-reply-button-container")
      )
        return;

      // Make sure it's actually a tweet (has text content)
      const tweetText = tweet.innerText || "";
      if (tweetText.length < 10) return;

      // Mark as processed BEFORE adding button
      processedPosts.add(tweet);

      const buttonContainer = createGenerateButton();
      const button = buttonContainer.querySelector(".ai-reply-button");
      const statusText = buttonContainer.querySelector(".ai-status-text");
      const icon = button.querySelector(".icon");
      const spinner = button.querySelector(".spinner");

      // Add click handler
      attachButtonClickHandler(
        button,
        buttonContainer,
        statusText,
        icon,
        spinner,
        tweet,
        platform
      );

      // Find the action buttons area (like, retweet, reply buttons)
      let actionArea = tweet.querySelector(
        "[role='group']:last-of-type, " + "[data-testid='tweet'] [role='group']"
      );

      if (actionArea) {
        // Insert button in the same container as other actions
        // Position it at the end (right side) along with other action buttons
        actionArea.appendChild(buttonContainer);
      } else {
        // Fallback: Look for any buttons container
        let buttonContainer_parent = tweet.querySelector("[role='group']");
        if (buttonContainer_parent) {
          buttonContainer_parent.appendChild(buttonContainer);
        } else {
          // Last resort: append to tweet with right positioning
          buttonContainer.style.display = "flex";
          buttonContainer.style.justifyContent = "flex-end";
          buttonContainer.style.width = "100%";
          tweet.appendChild(buttonContainer);
        }
      }
    });
  }
}

/**
 * Helper function to attach click handler to button
 * @param {HTMLElement} button - The button element
 * @param {HTMLElement} buttonContainer - The button container
 * @param {HTMLElement} statusText - The status text element
 * @param {HTMLElement} icon - The icon element
 * @param {HTMLElement} spinner - The spinner element
 * @param {HTMLElement} post - The post/tweet container
 * @param {string} platform - 'linkedin' or 'x'
 */
function attachButtonClickHandler(
  button,
  buttonContainer,
  statusText,
  icon,
  spinner,
  post,
  platform
) {
  button.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Start loading state
    button.disabled = true;
    icon.classList.add("hidden");
    spinner.classList.remove("hidden");
    button.style.cursor = "wait";
    button.style.opacity = "0.8";
    statusText.textContent = "Generating...";
    statusText.style.color = "#000";

    try {
      const postText = extractPostText(post);
      if (!postText.trim()) {
        throw new Error("Could not extract post text.");
      }

      console.log(
        `[${platform}] Extracted text: "${postText.substring(0, 50)}..."`
      );

      // Generate reply (now returns { reply, tone, platform, usage })
      const result = await generateReply(postText, platform);
      const reply = result.reply;
      const usage = result.usage;

      console.log(
        `[${platform}] Generated reply: "${reply.substring(0, 50)}..."`
      );
      if (usage) {
        console.log(
          `[${platform}] Usage: ${usage.daily_used}/${usage.daily_goal} daily, ${usage.weekly_used}/${usage.weekly_goal} weekly`
        );
      }

      // Fill reply box with the generated text
      await fillReplyBox(reply, post);

      // Success state
      icon.classList.remove("hidden");
      spinner.classList.add("hidden");
      button.style.background = "#10b981";
      button.style.borderColor = "#10b981";
      statusText.textContent = "✓ Reply generated!";
      statusText.style.color = "#10b981";

      setTimeout(() => {
        button.disabled = false;
        button.style.cursor = "pointer";
        button.style.opacity = "1";
        button.style.background = "#000000";
        button.style.borderColor = "#000000";
        statusText.textContent = "";
      }, 2000);
    } catch (error) {
      console.error(`[${platform}] Error:`, error);

      // Error state
      icon.classList.remove("hidden");
      spinner.classList.add("hidden");
      button.style.background = "#ef4444";
      button.style.borderColor = "#ef4444";
      statusText.textContent =
        error.message.length > 50 ? "Error - check console" : error.message;
      statusText.style.color = "#ef4444";
      alert(
        "Your token is Invalid or Not Present. Please go to the dashboard and click 'Send Token to Extension'."
      );
      setTimeout(() => {
        button.disabled = false;
        button.style.cursor = "pointer";
        button.style.opacity = "1";
        button.style.background = "#000000";
        button.style.borderColor = "#000000";
        statusText.textContent = "";
      }, 3000);
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
  }, 1000);

  // Watch for dynamically loaded posts (very common on LinkedIn and X)
  // Use a debounced approach to avoid performance issues
  let mutationTimeout;
  const observer = new MutationObserver(() => {
    clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
      attachButtonsToPosts();
    }, 500); // Wait 500ms after mutations stop before scanning
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false, // Don't watch attribute changes (performance)
  });

  // For X/Twitter: Also listen to URL changes to detect feed vs detail view
  if (platform === "x") {
    let lastUrl = window.location.href;

    // Monitor URL changes
    const urlObserver = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log("[X] URL changed from", lastUrl, "to", currentUrl);
        lastUrl = currentUrl;

        // Clear processed posts when navigating between views
        // This allows re-injection of buttons in detail view
        processedPosts.clear?.();

        // Re-run button attachment
        setTimeout(() => {
          console.log("[X] Re-scanning after URL change");
          attachButtonsToPosts();
        }, 500);
      }
    });

    // Watch for href attribute changes
    urlObserver.observe(document.documentElement, {
      subtree: true,
      attributeFilter: ["href"],
      attributes: true,
    });

    // Also use popstate to catch navigation
    window.addEventListener("popstate", () => {
      console.log("[X] Navigation detected (popstate)");
      processedPosts.clear?.();
      setTimeout(() => {
        console.log("[X] Re-scanning after navigation");
        attachButtonsToPosts();
      }, 500);
    });
  }

  console.log(
    "[AI Reply Generator] ✅ Ready! Generate buttons will appear on detail views"
  );
}

// Add CSS for the hidden class
const style = document.createElement("style");
style.textContent = `
  .hidden { display: none !important; }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  // DOM already loaded
  init();
}
