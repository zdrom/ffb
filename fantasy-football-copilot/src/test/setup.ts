// Test setup file
import { vi } from 'vitest';

// Mock environment variables
vi.stubEnv('OPENAI_API_KEY', 'test-key-123');
vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key-123');

// Mock import.meta.env for Vite
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_OPENAI_API_KEY: 'test-key-123'
      }
    }
  },
  writable: true
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock AbortSignal.timeout for older Node versions
if (!AbortSignal.timeout) {
  (AbortSignal as any).timeout = (delay: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), delay);
    return controller.signal;
  };
}