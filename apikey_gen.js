const crypto = require('crypto');

// Generate a 256-bit (32-byte) secure random API key
const apiKey = crypto.randomBytes(32).toString('hex');

console.log('Your secure API key:', apiKey);
