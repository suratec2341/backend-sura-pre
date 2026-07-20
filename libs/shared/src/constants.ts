// Shared constants across all services

/** API version prefix */
export const API_PREFIX = 'api/v1';

/** Roles for RBAC */
export enum Role {
  USER = 'user',
  ADMIN = 'admin',
  CONTENT_EDITOR = 'content_editor',
}

/** Content workflow status */
export enum ContentStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

/** Link health status */
export enum LinkStatus {
  ACTIVE = 'active',
  BROKEN = 'broken',
  PRIVATE = 'private',
  REMOVED = 'removed',
}

/** Video source type */
export enum SourceType {
  OWN_CHANNEL = 'own_channel',
  EXTERNAL_LICENSED = 'external_licensed',
}

/** Queue name constants */
export const QUEUES = {
  SESSION_PROCESS: 'session-process',
  AI_SUMMARY: 'ai-summary',
  AI_CHAT: 'ai-chat',
  NOTIFICATION: 'notification-send',
  HEALTH_SYNC: 'health-sync',
  LINK_CHECK: 'link-check',
  EPISODE_SUMMARY: 'episode-summary',
} as const;
