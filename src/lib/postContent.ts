import type { ContentType } from '@/types/database';

/** Photo posts can omit text; reflections still need a body. */
export function hasPostContent(contentType: ContentType, body: string, imageCount: number) {
  return body.trim().length > 0 || (contentType === 'caption' && imageCount > 0);
}
