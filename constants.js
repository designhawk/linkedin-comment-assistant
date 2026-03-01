/**
 * LinkedIn Comment Assistant - Constants
 * Centralized configuration values and magic numbers
 */

const CONFIG = {
  // Timeouts (in milliseconds)
  TIMEOUTS: {
    REQUEST: 30000,        // 30 seconds - API request timeout
    RETRY_DELAY: 1000,     // 1 second - base delay between retries
    ERROR_DISPLAY: 5000,   // 5 seconds - how long to show error messages
    COPY_FEEDBACK: 2000,   // 2 seconds - "Copied!" feedback duration
    SPEED_TEST_DELAY: 500  // 0.5 seconds - delay between model speed tests
  },
  
  // Cache durations (in milliseconds)
  CACHE: {
    MODELS: 24 * 60 * 60 * 1000  // 24 hours - model list cache
  },
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3  // Maximum retry attempts for failed requests
  },
  
  // API Configuration
  API: {
    MAX_TOKENS: 250,      // Maximum tokens for comment generation
    TEMPERATURE: 0.85,    // Temperature for generation (higher = more creative)
    TEST_MAX_TOKENS: 10,  // Tokens for API key test
    TEST_TEMPERATURE: 0.7 // Temperature for API key test
  },
  
  // UI Configuration
  UI: {
    PANEL_WIDTH: 320,     // Sidepanel width in pixels
    MAX_COMMENT_LENGTH: 500 // Maximum characters for a comment
  },
  
  // Response Time Tracking
  SPEED_TEST: {
    MAX_STORED_TIMES: 5,  // Number of response times to keep per model
    TEST_MESSAGE: 'Say "API key is valid"'  // Test message for speed tests
  },
  
  // Debug mode
  DEBUG: false  // Set to true for verbose logging
};

// Make available in different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}