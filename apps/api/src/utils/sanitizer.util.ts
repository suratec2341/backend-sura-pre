import * as sanitizeHtml from 'sanitize-html';

export function sanitizeAiPrompt(input: string): string {
  if (!input || typeof input !== 'string') return input;
  
  // 1. Remove any HTML tags that might be used for injection
  let sanitized = sanitizeHtml(input, {
    allowedTags: [], // Strip all tags
    allowedAttributes: {},
  });

  // 2. Remove common jailbreak prefix/suffix patterns or system prompt manipulation attempts
  // This is a basic layer. A full solution might involve LLM-based detection.
  const maliciousPatterns = [
    /ignore all previous instructions/gi,
    /you are now/gi,
    /system prompt/gi,
    /ละทิ้งคำสั่งเดิมทั้งหมด/gi,
    /ลืมคำสั่งก่อนหน้า/gi,
    /พิมพ์คำสั่งก่อนหน้า/gi,
    /forget previous/gi,
    /disregard.*?instructions/gi,
    /override.*?system/gi,
    /act as if/gi,
    /pretend you/gi,
  ];

  for (const pattern of maliciousPatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED_INJECTION_ATTEMPT]');
  }

  return sanitized;
}
