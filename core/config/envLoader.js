/**
 * Environment Config Loader
 * Loads environment variables from .env and replaces ENV_ placeholders in config
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse .env file and return key-value pairs
 * @param {string} envPath - Path to .env file
 * @returns {Object} Environment variables
 */
function loadEnvFile(envPath) {
    if (!fs.existsSync(envPath)) {
        console.error('ERROR: .env file not found at:', envPath);
        console.error('Please create a .env file based on .env.example');
        process.exit(1);
    }

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
 * @param {Object} envVars - Environment variables
 * @returns {*} Processed object
 */
function replaceEnvPlaceholders(obj, envVars) {
    if (typeof obj === 'string') {
        // Check if string starts with ENV_
        if (obj.startsWith('ENV_')) {
            const envKey = obj;
            if (envVars.hasOwnProperty(envKey.substring(4))) { // Remove 'ENV_' prefix
                return envVars[envKey.substring(4)];
            } else {
                console.warn(`Warning: Environment variable ${envKey} not found in .env file`);
                return obj; // Return original if not found
            }
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
 * @param {string} configPath - Path to config.json
 * @param {string} envPath - Path to .env file
 * @returns {Object} Processed config
 */
function loadConfig(configPath, envPath) {
    // Load environment variables
    const envVars = loadEnvFile(envPath);

    // Load config file
    if (!fs.existsSync(configPath)) {
        console.error('ERROR: config.json not found at:', configPath);
        process.exit(1);
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    let config;
    
    try {
        config = JSON.parse(configContent);
    } catch (error) {
        console.error('ERROR: Failed to parse config.json:', error.message);
        process.exit(1);
    }

    // Replace all ENV_ placeholders with actual values
    config = replaceEnvPlaceholders(config, envVars);

    console.log('✅ Config loaded successfully with environment variables');
    
    return config;
}

module.exports = {
    loadConfig,
    loadEnvFile,
    replaceEnvPlaceholders
};
