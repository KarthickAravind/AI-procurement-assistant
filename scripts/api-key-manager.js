#!/usr/bin/env node

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class APIKeyManager {
  constructor() {
    this.apiKeys = this.loadAPIKeys();
    this.currentKeyIndex = 0;
    this.keyStatus = new Map();
    this.initializeKeyStatus();
  }

  loadAPIKeys() {
    const keys = [];
    for (let i = 1; i <= 10; i++) {
      const key = process.env[`GEMINI_API_KEY_${i}`];
      if (key) {
        keys.push({
          index: i,
          key: key,
          name: `API_KEY_${i}`,
          masked: this.maskKey(key)
        });
      }
    }
    return keys;
  }

  initializeKeyStatus() {
    this.apiKeys.forEach((keyInfo, index) => {
      this.keyStatus.set(index, {
        isActive: index === 0,
        quotaExceeded: false,
        lastUsed: null,
        requestCount: 0,
        errors: []
      });
    });
  }

  maskKey(key) {
    if (!key || key.length < 8) return '***';
    return key.substring(0, 4) + '***' + key.substring(key.length - 4);
  }

  async checkQuota(keyIndex) {
    try {
      const keyInfo = this.apiKeys[keyIndex];
      if (!keyInfo) {
        throw new Error(`API key ${keyIndex + 1} not found`);
      }

      console.log(`🔍 Checking quota for ${keyInfo.name}...`);
      
      const genAI = new GoogleGenerativeAI(keyInfo.key);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const startTime = Date.now();
      const result = await model.generateContent("Test quota check");
      const responseTime = Date.now() - startTime;

      const status = this.keyStatus.get(keyIndex);
      status.lastUsed = new Date();
      status.requestCount++;
      status.quotaExceeded = false;
      status.errors = [];

      console.log(`✅ ${keyInfo.name} is working`);
      console.log(`   Response time: ${responseTime}ms`);
      console.log(`   Response: ${result.response.text().substring(0, 50)}...`);
      
      return {
        success: true,
        responseTime,
        keyInfo,
        response: result.response.text()
      };

    } catch (error) {
      const status = this.keyStatus.get(keyIndex);
      status.errors.push({
        timestamp: new Date(),
        error: error.message
      });

      if (error.message.includes('quota') || error.message.includes('429')) {
        status.quotaExceeded = true;
        console.log(`❌ ${this.apiKeys[keyIndex].name} - Quota exceeded`);
      } else {
        console.log(`❌ ${this.apiKeys[keyIndex].name} - Error: ${error.message}`);
      }

      return {
        success: false,
        error: error.message,
        keyInfo: this.apiKeys[keyIndex]
      };
    }
  }

  async checkAllQuotas() {
    console.log(`🔍 Checking quotas for all ${this.apiKeys.length} API keys...\n`);
    
    const results = [];
    for (let i = 0; i < this.apiKeys.length; i++) {
      const result = await this.checkQuota(i);
      results.push(result);
      
      // Add delay between requests to avoid rate limiting
      if (i < this.apiKeys.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.displaySummary(results);
    return results;
  }

  displayStatus() {
    console.log('\n📊 API Key Status Report');
    console.log('=' .repeat(60));
    
    this.apiKeys.forEach((keyInfo, index) => {
      const status = this.keyStatus.get(index);
      const isActive = status.isActive ? '🟢 ACTIVE' : '⚪ INACTIVE';
      const quotaStatus = status.quotaExceeded ? '❌ QUOTA_EXCEEDED' : '✅ AVAILABLE';
      
      console.log(`\n${keyInfo.name} (${keyInfo.masked})`);
      console.log(`  Status: ${isActive}`);
      console.log(`  Quota: ${quotaStatus}`);
      console.log(`  Requests: ${status.requestCount}`);
      console.log(`  Last Used: ${status.lastUsed ? status.lastUsed.toLocaleString() : 'Never'}`);
      
      if (status.errors.length > 0) {
        console.log(`  Recent Errors: ${status.errors.length}`);
        const lastError = status.errors[status.errors.length - 1];
        console.log(`    Latest: ${lastError.error.substring(0, 80)}...`);
      }
    });
  }

  displaySummary(results) {
    console.log('\n📈 Quota Check Summary');
    console.log('=' .repeat(40));
    
    const working = results.filter(r => r.success).length;
    const quotaExceeded = results.filter(r => !r.success && r.error.includes('quota')).length;
    const otherErrors = results.filter(r => !r.success && !r.error.includes('quota')).length;
    
    console.log(`✅ Working keys: ${working}/${this.apiKeys.length}`);
    console.log(`❌ Quota exceeded: ${quotaExceeded}/${this.apiKeys.length}`);
    console.log(`⚠️  Other errors: ${otherErrors}/${this.apiKeys.length}`);
    
    if (working > 0) {
      console.log(`\n🎯 Recommended active key: ${results.find(r => r.success).keyInfo.name}`);
    } else {
      console.log(`\n⚠️  No working keys available!`);
    }
  }

  switchActiveKey(keyIndex) {
    if (keyIndex < 0 || keyIndex >= this.apiKeys.length) {
      console.log(`❌ Invalid key index. Available keys: 1-${this.apiKeys.length}`);
      return false;
    }

    // Update status
    this.keyStatus.forEach((status, index) => {
      status.isActive = index === keyIndex;
    });

    this.currentKeyIndex = keyIndex;
    const keyInfo = this.apiKeys[keyIndex];
    
    console.log(`🔄 Switched to ${keyInfo.name} (${keyInfo.masked})`);
    
    // Update environment variable for current session
    process.env.GEMINI_API_KEY = keyInfo.key;
    
    return true;
  }

  listKeys() {
    console.log('\n🔑 Available API Keys');
    console.log('=' .repeat(40));
    
    this.apiKeys.forEach((keyInfo, index) => {
      const status = this.keyStatus.get(index);
      const isActive = status.isActive ? '🟢' : '⚪';
      const quotaStatus = status.quotaExceeded ? '❌' : '✅';
      
      console.log(`${index + 1}. ${isActive} ${keyInfo.name} ${quotaStatus}`);
      console.log(`   Key: ${keyInfo.masked}`);
      console.log(`   Requests: ${status.requestCount}`);
    });
  }

  async findBestKey() {
    console.log('🔍 Finding best available API key...\n');
    
    for (let i = 0; i < this.apiKeys.length; i++) {
      const result = await this.checkQuota(i);
      if (result.success) {
        this.switchActiveKey(i);
        console.log(`\n🎯 Best key found and activated: ${result.keyInfo.name}`);
        return result.keyInfo;
      }
      
      // Small delay between checks
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n❌ No working API keys found!');
    return null;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const manager = new APIKeyManager();
  
  if (manager.apiKeys.length === 0) {
    console.log('❌ No API keys found in environment variables.');
    console.log('   Please set GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc. in your .env file');
    process.exit(1);
  }

  console.log(`🔑 Found ${manager.apiKeys.length} API keys in environment\n`);

  switch (command) {
    case 'status':
      manager.displayStatus();
      break;
      
    case 'check':
      const keyIndex = args[1] ? parseInt(args[1]) - 1 : null;
      if (keyIndex !== null) {
        await manager.checkQuota(keyIndex);
      } else {
        await manager.checkAllQuotas();
      }
      break;
      
    case 'switch':
      const switchIndex = parseInt(args[1]) - 1;
      manager.switchActiveKey(switchIndex);
      break;
      
    case 'list':
      manager.listKeys();
      break;
      
    case 'find':
      await manager.findBestKey();
      break;
      
    case 'help':
    default:
      console.log('🔑 API Key Manager - Usage:');
      console.log('');
      console.log('  node scripts/api-key-manager.js <command> [options]');
      console.log('');
      console.log('Commands:');
      console.log('  status              Show status of all API keys');
      console.log('  check [key_number]  Check quota for specific key or all keys');
      console.log('  switch <key_number> Switch to specific API key (1-N)');
      console.log('  list                List all available API keys');
      console.log('  find                Find and switch to best working key');
      console.log('  help                Show this help message');
      console.log('');
      console.log('Examples:');
      console.log('  node scripts/api-key-manager.js status');
      console.log('  node scripts/api-key-manager.js check 2');
      console.log('  node scripts/api-key-manager.js switch 3');
      console.log('  node scripts/api-key-manager.js find');
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = APIKeyManager;
