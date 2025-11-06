# 🔧 Troubleshooting: Buttons Not Showing

## Quick Fix Checklist

### ✅ Step 1: Verify Extension is Loaded
1. Go to `chrome://extensions/`
2. Look for "AI Reply Generator" 
3. Make sure it's **enabled** (toggle should be ON)
4. If not there, click "Load unpacked" and select the `/extension` folder

### ✅ Step 2: Check Backend is Running
```bash
# In terminal, check if backend is running on port 3000
curl http://localhost:3000/health

# Should respond with: {"status":"ok","message":"Backend is running"}

# If not running, start it:
cd backend
npm start
```

### ✅ Step 3: Refresh the Page
- Go to LinkedIn or X
- Press **Cmd+R** (Mac) or **Ctrl+R** (Windows) to hard refresh
- Wait 2-3 seconds for buttons to appear

### ✅ Step 4: Check Browser Console for Errors
1. Right-click on the page → **Inspect**
2. Go to **Console** tab
3. Look for any red error messages
4. You should see: `[AI Reply Generator] ✅ Ready! Look for 🧠 Generate Reply buttons`

---

## Detailed Debugging

### If buttons STILL don't appear:

**Option A: Manual Debug in Console**
1. Open DevTools (Cmd+Option+J on Mac)
2. Copy-paste everything from `/extension/DEBUG.md`
3. This will tell you:
   - If the extension is loaded
   - How many posts were found
   - If backend is running

**Option B: Check Extension Logs**
1. Go to `chrome://extensions/`
2. Find "AI Reply Generator"
3. Click "Inspect views: service worker"
4. Look for any error messages

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **No buttons at all** | Check extension is enabled + backend is running |
| **Buttons appear then disappear** | Page is reloading posts - this is normal, buttons reappear |
| **Button shows "Error: Backend not responding"** | Make sure `npm start` is running in `/backend` folder |
| **Button shows "Invalid API key"** | Check your `.env` file has correct OpenAI key |
| **Buttons only on some posts** | Page may still be loading - wait a few seconds |
| **Works on LinkedIn but not X** | Try refreshing X in a new tab |

---

## Force Injection Test

### LinkedIn Test
1. Go to https://www.linkedin.com/feed/
2. Open DevTools (Cmd+Option+J)
3. Paste this and press Enter:
```javascript
// Force scan for posts
document.querySelectorAll("[data-test-id='post'], [class*='artdeco-card']").length
```
- If you see a number > 0, posts are being found
- If 0, the page structure has changed

### X/Twitter Test
1. Go to https://x.com/explore
2. Open DevTools (Cmd+Option+J)
3. Paste this and press Enter:
```javascript
// Count tweets
document.querySelectorAll("article").length
```
- If you see a number > 0, tweets are being found

---

## Still Not Working?

### Nuclear Option: Reload Extension
1. Go to `chrome://extensions/`
2. Click the **reload** icon (circular arrow) on "AI Reply Generator"
3. Go back to LinkedIn/X and refresh the page
4. Wait 3 seconds for buttons to appear

### Last Resort: Clear & Reinstall
```bash
# Unload from Chrome:
# 1. chrome://extensions/
# 2. Click the trash icon next to "AI Reply Generator"

# Then reload:
# 1. cd /Users/hardy/Developer/projects/replier/extension
# 2. Go to chrome://extensions/
# 3. Click "Load unpacked"
# 4. Select the extension folder
```

---

## Getting Help

**Check the logs:**
```javascript
// In browser console on LinkedIn/X, type:
console.log = function(...args) {
  console.warn(...args); // This will show all logs
};

// Then trigger: 
// - Right-click post → Inspect (to find post)
// - You'll see logs about what's being selected
```

**Check what the extension sees:**
```javascript
// Refresh page, then in console:
document.querySelectorAll("[data-test-id='post']").length  // LinkedIn
document.querySelectorAll("article").length               // X/Twitter
```

If these return 0, the DOM selectors need updating. The page structure changed.

---

## Known Limitations

- **New posts take 2-3 seconds to get buttons** - The extension watches for new content
- **Buttons may disappear briefly** - When page reloads/updates posts
- **Some premium/ad posts** may not be detected properly
- **Works best with standard feed layout** - Some custom layouts may not work

---

Still stuck? Make sure:
1. ✅ Extension is enabled in `chrome://extensions/`
2. ✅ Backend is running (`npm start` in `/backend`)
3. ✅ Page is fully loaded (wait 3-5 seconds)
4. ✅ Using a standard feed view on LinkedIn or X
5. ✅ No console errors (check DevTools)
