export const openaiConfig = {
  apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '',
  model: process.env.GEMINI_MODEL || 'gemini-pro',
  endpoint: process.env.GEMINI_ENDPOINT || 'https://api.openai.com/v1',
};
