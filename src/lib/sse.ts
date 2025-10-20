/**
 * Server-Sent Events (SSE) utilities
 */

const encoder = new TextEncoder();

/**
 * Encode data as SSE format
 */
export function encodeSSE(type: string, data: any): Uint8Array {
  return encoder.encode(
    `data:${JSON.stringify({ type, ...data })}\n\n`
  );
}

/**
 * Standard SSE response headers
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;
