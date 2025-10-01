/**
 * Environment Config Loader
 * Works both locally (with .env file) and in production (with platform env vars)
 * Compatible with Nixpacks, Railway, Heroku, Docker, etc.
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse .env file and return key-value pairs
 * @param {string} envPath - Path to .env file
 * @returns {Object} Environment variables
 */
function loadEnvFile(envPath) {
    // Check if .env file exists (for local development)
    if (!fs.existsSync(envPath)) {
        console.log('ℹ️  No .env file found - using platform environment variables (production mode)');
        return {}; // Return empty object, will use process.env instead
    }

    console.log('✅ Loading .env file (local development mode)');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};

    // Parse .env file line by line
    envContent.split('\n').forEach(line => {
        // Skip comments and empty lines
        line = line.trim();
        if (!line || line.startsWith('#')) return;

        // Parse KEY=VALUE format
        const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (match) {
            const key = match[1];
            let value = match[2].trim();

            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            envVars[key] = value;
            // Also set in process.env for compatibility
            process.env[key] = value;
        }
    });

    return envVars;
}

/**
 * Recursively replace ENV_ placeholders in an object
 * @param {*} obj - Object to process
 * @param {Object} envVars - Environment variables from .env file
 * @returns {*} Processed object
 */
function replaceEnvPlaceholders(obj, envVars) {
    if (typeof obj === 'string') {
        // Check if string starts with ENV_
        if (obj.startsWith('ENV_')) {
            const envKey = obj.substring(4); // Remove 'ENV_' prefix
            
            // Try to get from .env file first (local dev)
            if (envVars.hasOwnProperty(envKey)) {
                return envVars[envKey];
            }
            
            // Try to get from process.env (production/platform)
            if (process.env.hasOwnProperty(envKey)) {
                return process.env[envKey];
            }
            
            // If still not found, show warning
            console.warn(`⚠️  Warning: Environment variable ${envKey} not found`);
            return obj; // Return original if not found
        }
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => replaceEnvPlaceholders(item, envVars));
    }

    if (obj !== null && typeof obj === 'object') {
        const newObj = {};
        for (const key in obj) {
            newObj[key] = replaceEnvPlaceholders(obj[key], envVars);
        }
        return newObj;
    }

    return obj;
}

/**
 * Load config with environment variable substitution
 * Works with both .env file (local) and platform env vars (production)
 * @param {string} configPath - Path to config.json
 * @param {string} envPath - Path to .env file (optional in production)
 * @returns {Object} Processed config
 */
function loadConfig(configPath, envPath) {
    // Load environment variables from .env file if it exists
    // In production (Nixpacks/Railway), this will be empty and process.env will be used
    const envVars = loadEnvFile(envPath);

    // Load config file
    if (!fs.existsSync(configPath)) {
        console.error('❌ ERROR: config.json not found at:', configPath);
        process.exit(1);
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    let config;
    
    try {
        config = JSON.parse(configContent);
    } catch (error) {
        console.error('❌ ERROR: Failed to parse config.json:', error.message);
        process.exit(1);
    }

    // Replace all ENV_ placeholders with actual values
    // This works with both .env file variables and platform environment variables
    config = replaceEnvPlaceholders(config, envVars);

    // Validate critical environment variables
    const requiredVars = ['TOKEN', 'SERVER_ID'];
    const missingVars = [];
    
    for (const varName of requiredVars) {
        if (!process.env[varName] && !envVars[varName]) {
            missingVars.push(varName);
        }
    }
    
    if (missingVars.length > 0) {
        console.error('❌ ERROR: Missing required environment variables:');
        missingVars.forEach(v => console.error(`   - ${v}`));
        console.error('\n💡 Set these in your .env file (local) or platform dashboard (production)');
        process.exit(1);
    }

    console.log('✅ Config loaded successfully with environment variables');
    
    return config;
}

module.exports = {
    loadConfig,
    loadEnvFile,
    replaceEnvPlaceholders
};
