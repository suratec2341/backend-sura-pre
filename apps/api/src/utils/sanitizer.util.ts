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
    /ignore all previous instructions/i,
    /you are now/i,
    /system prompt/i,
    /ละทิ้งคำสั่งเดิมทั้งหมด/i,
    /ลืมคำสั่งก่อนหน้า/i,
    /พิมพ์คำสั่งก่อนหน้า/i,
    /forget previous/i
  ];

  for (const pattern of maliciousPatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED_INJECTION_ATTEMPT]');
  }

  return sanitized;
}
