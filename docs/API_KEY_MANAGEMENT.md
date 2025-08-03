# 🔑 API Key Management Guide

This guide explains how to manage Google Gemini API keys for the AI Procurement Assistant.

## 📋 Overview

The API Key Manager helps you:
- **Monitor quota usage** for all API keys
- **Check key availability** and response times
- **Switch between keys** when quotas are exceeded
- **Find the best working key** automatically
- **Track usage statistics** and error history

## 🚀 Quick Start

### 1. Setup API Keys in Environment

Add multiple Gemini API keys to your `.env` file:

```bash
# Primary API keys
GEMINI_API_KEY_1=AIzaSyC...your-first-key
GEMINI_API_KEY_2=AIzaSyD...your-second-key
GEMINI_API_KEY_3=AIzaSyE...your-third-key
GEMINI_API_KEY_4=AIzaSyF...your-fourth-key
GEMINI_API_KEY_5=AIzaSyG...your-fifth-key

# Current active key (automatically managed)
GEMINI_API_KEY=AIzaSyC...your-first-key
```

### 2. Available Commands

```bash
# Check status of all API keys
npm run api-status

# Check quota for all keys
npm run api-check

# Check quota for specific key (1-5)
npm run api-check 2

# Switch to specific API key
npm run api-switch 3

# List all available keys
npm run api-list

# Find and switch to best working key
npm run api-find

# Show help
npm run api-help
```

## 📊 Command Details

### `npm run api-status`
Shows current status of all API keys:
```
📊 API Key Status Report
============================================================

API_KEY_1 (AIza***2rfQ)
  Status: 🟢 ACTIVE
  Quota: ❌ QUOTA_EXCEEDED
  Requests: 45
  Last Used: 2025-08-03 8:25:30 PM

API_KEY_2 (AIza***Va-I)
  Status: ⚪ INACTIVE
  Quota: ✅ AVAILABLE
  Requests: 12
  Last Used: 2025-08-03 7:15:22 PM
```

### `npm run api-check`
Tests quota availability for all keys:
```
🔍 Checking quotas for all 5 API keys...

✅ API_KEY_2 is working
   Response time: 1391ms
❌ API_KEY_1 - Quota exceeded

📈 Quota Check Summary
========================================
✅ Working keys: 4/5
❌ Quota exceeded: 1/5
🎯 Recommended active key: API_KEY_2
```

### `npm run api-switch <number>`
Switches to specific API key:
```bash
npm run api-switch 2
# Output: 🔄 Switched to API_KEY_2 (AIza***Va-I)
```

### `npm run api-find`
Automatically finds and switches to best working key:
```
🔍 Finding best available API key...
✅ API_KEY_3 is working
🔄 Switched to API_KEY_3 (AIza***cnq0)
🎯 Best key found and activated: API_KEY_3
```

## 🔧 Integration with Application

### Automatic Key Rotation
The application automatically rotates keys when quotas are exceeded:

```javascript
// In srv/ai-chat/apiKeyManager.js
if (error.status === 429) {
  console.log('🔄 Quota exceeded, rotating to next key...');
  this.rotateToNextKey();
}
```

### Manual Key Management
Use the CLI tool for manual management:

```bash
# Check which key is currently active
npm run api-status

# If quota exceeded, find best key
npm run api-find

# Or manually switch to specific key
npm run api-switch 4
```

## 📈 Monitoring and Troubleshooting

### Daily Quota Limits
- **Free tier**: 50 requests per day per key
- **Paid tier**: Higher limits based on plan

### Best Practices

1. **Multiple Keys**: Use 5+ API keys for high availability
2. **Regular Monitoring**: Check status daily with `npm run api-status`
3. **Automatic Rotation**: Let the app handle rotation during operation
4. **Manual Override**: Use CLI tools when needed

### Common Issues

**Issue**: All keys showing quota exceeded
```bash
# Solution: Wait for quota reset (daily) or upgrade to paid tier
npm run api-check
# Check when quotas reset (usually midnight UTC)
```

**Issue**: Keys not working
```bash
# Solution: Verify keys are valid
npm run api-check 1  # Test specific key
# Check Google Cloud Console for key status
```

**Issue**: Slow response times
```bash
# Solution: Find fastest key
npm run api-find
# This tests all keys and picks the fastest working one
```

## 🛠️ Advanced Usage

### Direct Script Usage
```bash
# Run script directly with more options
node scripts/api-key-manager.js status
node scripts/api-key-manager.js check 3
node scripts/api-key-manager.js switch 2
```

### Integration in Code
```javascript
const APIKeyManager = require('./scripts/api-key-manager.js');

const manager = new APIKeyManager();
await manager.checkAllQuotas();
const bestKey = await manager.findBestKey();
```

## 📝 Logs and Debugging

The API Key Manager provides detailed logging:
- ✅ **Success**: Key working with response time
- ❌ **Quota Exceeded**: 429 errors from Google
- ⚠️ **Other Errors**: Network, authentication issues
- 🔄 **Key Rotation**: Automatic switching events

## 🎯 Production Recommendations

1. **Monitor Daily**: Check `npm run api-status` each morning
2. **Set Alerts**: Monitor for quota exceeded patterns
3. **Upgrade Plan**: Consider paid tier for production use
4. **Key Rotation**: Use `npm run api-find` when issues occur
5. **Backup Keys**: Always have 3+ working keys available

---

For more help, run `npm run api-help` or check the main project documentation.
