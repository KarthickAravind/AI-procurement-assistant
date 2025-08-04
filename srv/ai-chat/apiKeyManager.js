/**
 * API Key Manager for Gemini API
 * Handles automatic rotation when quota limits are exceeded
 */

require('dotenv').config();

class APIKeyManager {
  constructor() {
    this.apiKeys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5,
      process.env.GEMINI_API_KEY_6,
      process.env.GEMINI_API_KEY_7,
      process.env.GEMINI_API_KEY_8
    ].filter(key => key && key.trim() !== ''); // Remove empty keys
    
    this.currentKeyIndex = 0;
    this.failedKeys = new Set(); // Track keys that have exceeded quota
    this.lastRotationTime = Date.now();
    
    console.log(`🔑 API Key Manager initialized with ${this.apiKeys.length} keys`);
  }

  /**
   * Get the current active API key
   */
  getCurrentKey() {
    if (this.apiKeys.length === 0) {
      throw new Error('No API keys available');
    }

    // If current key has failed, try to get next available key
    if (this.failedKeys.has(this.currentKeyIndex)) {
      this.rotateToNextKey();
    }

    const currentKey = this.apiKeys[this.currentKeyIndex];
    console.log(`🔑 Using API key ${this.currentKeyIndex + 1}/${this.apiKeys.length}`);
    return currentKey;
  }

  /**
   * Mark current key as failed and rotate to next
   */
  markCurrentKeyAsFailed(error) {
    console.log(`❌ API key ${this.currentKeyIndex + 1} failed:`, error.message);
    
    // Check if it's a quota error
    if (this.isQuotaError(error)) {
      console.log(`🚫 Marking API key ${this.currentKeyIndex + 1} as quota exceeded`);
      this.failedKeys.add(this.currentKeyIndex);
    }

    // Try to rotate to next available key
    const rotated = this.rotateToNextKey();
    
    if (!rotated) {
      console.log('⚠️ All API keys have been exhausted');
      // Reset failed keys if all are exhausted (quota might have reset)
      if (this.shouldResetFailedKeys()) {
        this.resetFailedKeys();
      }
    }

    return rotated;
  }

  /**
   * Rotate to the next available API key
   */
  rotateToNextKey() {
    const startIndex = this.currentKeyIndex;
    
    do {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      
      // If we've cycled through all keys, break
      if (this.currentKeyIndex === startIndex) {
        break;
      }
    } while (this.failedKeys.has(this.currentKeyIndex));

    // Check if we found a working key
    const foundWorkingKey = !this.failedKeys.has(this.currentKeyIndex);
    
    if (foundWorkingKey) {
      console.log(`🔄 Rotated to API key ${this.currentKeyIndex + 1}/${this.apiKeys.length}`);
      this.lastRotationTime = Date.now();
    }

    return foundWorkingKey;
  }

  /**
   * Check if error is a quota/rate limit error
   */
  isQuotaError(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorStatus = error.status;
    
    return (
      errorStatus === 429 || // Too Many Requests
      errorMessage.includes('quota') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('exceeded')
    );
  }

  /**
   * Check if we should reset failed keys (e.g., after 24 hours)
   */
  shouldResetFailedKeys() {
    const RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    return (Date.now() - this.lastRotationTime) > RESET_INTERVAL;
  }

  /**
   * Reset failed keys (quotas might have reset)
   */
  resetFailedKeys() {
    console.log('🔄 Resetting failed API keys (quotas may have reset)');
    this.failedKeys.clear();
    this.currentKeyIndex = 0;
    this.lastRotationTime = Date.now();
  }

  /**
   * Get status of all API keys
   */
  getStatus() {
    return {
      totalKeys: this.apiKeys.length,
      currentKeyIndex: this.currentKeyIndex,
      failedKeys: Array.from(this.failedKeys),
      availableKeys: this.apiKeys.length - this.failedKeys.size,
      lastRotationTime: this.lastRotationTime
    };
  }

  /**
   * Test if current key is working
   */
  async testCurrentKey() {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(this.getCurrentKey());
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Simple test request
      const result = await model.generateContent('Test');
      console.log('✅ API key test successful');
      return true;
    } catch (error) {
      console.log('❌ API key test failed:', error.message);
      return false;
    }
  }

  /**
   * Mask API key for display
   */
  maskKey(key) {
    if (!key || key.length < 8) return '***';
    return key.substring(0, 4) + '***' + key.substring(key.length - 4);
  }

  /**
   * Switch to specific key index
   */
  switchToKey(keyIndex) {
    if (keyIndex < 0 || keyIndex >= this.apiKeys.length) {
      throw new Error(`Invalid key index. Available keys: 1-${this.apiKeys.length}`);
    }

    this.currentKeyIndex = keyIndex;
    console.log(`🔄 Manually switched to API key ${keyIndex + 1}/${this.apiKeys.length}`);

    // Remove from failed keys if it was marked as failed
    this.failedKeys.delete(keyIndex);

    return this.getCurrentKey();
  }

  /**
   * Get detailed status information
   */
  getDetailedStatus() {
    return {
      totalKeys: this.apiKeys.length,
      currentKeyIndex: this.currentKeyIndex,
      currentKeyName: `API_KEY_${this.currentKeyIndex + 1}`,
      failedKeys: Array.from(this.failedKeys),
      availableKeys: this.apiKeys.length - this.failedKeys.size,
      lastRotationTime: this.lastRotationTime,
      keyDetails: this.apiKeys.map((key, index) => ({
        index: index + 1,
        name: `API_KEY_${index + 1}`,
        masked: this.maskKey(key),
        isActive: index === this.currentKeyIndex,
        isFailed: this.failedKeys.has(index),
        status: this.failedKeys.has(index) ? 'FAILED' :
                index === this.currentKeyIndex ? 'ACTIVE' : 'AVAILABLE'
      }))
    };
  }

  /**
   * Display status in console
   */
  displayStatus() {
    const status = this.getDetailedStatus();

    console.log('\n📊 Server API Key Status');
    console.log('=' .repeat(40));
    console.log(`Total Keys: ${status.totalKeys}`);
    console.log(`Current Key: ${status.currentKeyName}`);
    console.log(`Available Keys: ${status.availableKeys}/${status.totalKeys}`);
    console.log(`Failed Keys: ${status.failedKeys.length}`);
    console.log(`Last Rotation: ${new Date(status.lastRotationTime).toLocaleString()}`);

    console.log('\nKey Details:');
    status.keyDetails.forEach(key => {
      const statusIcon = key.status === 'ACTIVE' ? '🟢' :
                        key.status === 'FAILED' ? '❌' : '⚪';
      console.log(`  ${statusIcon} ${key.name} (${key.masked}) - ${key.status}`);
    });
  }
}

// Export singleton instance
module.exports = new APIKeyManager();
