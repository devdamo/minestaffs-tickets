#!/usr/bin/env node

// Simple health check for the Discord bot
// This can be used by deployment systems to verify the bot is running correctly

const fs = require('fs');
const path = require('path');

// Check if the bot is running by looking for key files
const requiredFiles = [
    'index.js',
    'config.json',
    'package.json'
];

let healthy = true;
const errors = [];

// Check required files exist
requiredFiles.forEach(file => {
    if (!fs.existsSync(path.join(__dirname, file))) {
        healthy = false;
        errors.push(`Missing required file: ${file}`);
    }
});

// Check config is valid JSON
try {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    if (!config.token || !config.serverId) {
        healthy = false;
        errors.push('Invalid config: missing token or serverId');
    }
} catch (e) {
    healthy = false;
    errors.push(`Config parse error: ${e.message}`);
}

if (healthy) {
    console.log('✅ Health check passed');
    process.exit(0);
} else {
    console.error('❌ Health check failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
}
