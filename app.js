// ══════════════════════════════════════════════════════════════════════════
//  🔑 API CONFIGURATION — INJECTED BY GITHUB ACTIONS
//  
//  IMPORTANT: Do NOT change these placeholder values!
//  GitHub Actions will automatically replace them during deployment.
// ══════════════════════════════════════════════════════════════════════════

const API_KEYS = {
  // Google Gemini API Key (for AI prospect analysis)
  // Replaced automatically by GitHub Actions from secrets.GEMINI_API_KEY
  GEMINI_API_KEY: 'GEMINI_API_KEY_PLACEHOLDER',
  
  // Google Vision API Key (for OCR/image analysis)
  // Replaced automatically by GitHub Actions from secrets.GOOGLE_VISION_API_KEY
  GOOGLE_VISION_API_KEY: 'VISION_API_KEY_PLACEHOLDER'
};

// Gemini API endpoint - using Flash model for speed
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// ══════════════════════════════════════════════════════════════════════════
//  END API CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════

/*
  HOW THIS WORKS:
  
  1. In Git: This file has "GEMINI_API_KEY_PLACEHOLDER" and "VISION_API_KEY_PLACEHOLDER"
  2. During deployment: GitHub Actions replaces these with real keys from Secrets
  3. On live site: The deployed app.js has your actual API keys
  
  NEVER commit real API keys to Git - always use these placeholders!
*/