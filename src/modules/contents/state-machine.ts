import { ContentStatus } from '@prisma/client';

/**
 * Transições permitidas entre status. Cada chave é o status atual; o array são os
 * status alcançáveis. Edit in-place (mantendo status) é tratado fora daqui.
 */
export const ALLOWED_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: ['EXPANDED', 'APPROVED', 'ARCHIVED'],
  EXPANDED: ['DRAFT', 'APPROVED', 'ARCHIVED'],
  APPROVED: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'],
  SCHEDULED: ['APPROVED', 'PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['UNPUBLISHED', 'ARCHIVED'],
  UNPUBLISHED: ['PUBLISHED', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

/**
 * Roles permitidas a executar cada transição.
 * Empty / undefined = qualquer admin role autenticada.
 */
export const TRANSITION_ROLES: Partial<Record<`${ContentStatus}->${ContentStatus}`, ('ADMIN' | 'EDITOR' | 'REVISOR')[]>> = {
  'DRAFT->EXPANDED': ['ADMIN', 'EDITOR'],
  'EXPANDED->APPROVED': ['ADMIN', 'REVISOR'],
  'EXPANDED->DRAFT': ['ADMIN', 'REVISOR', 'EDITOR'],
  'APPROVED->SCHEDULED': ['ADMIN', 'EDITOR'],
  'APPROVED->PUBLISHED': ['ADMIN'],
  'SCHEDULED->PUBLISHED': ['ADMIN'],
  'PUBLISHED->UNPUBLISHED': ['ADMIN'],
  'UNPUBLISHED->PUBLISHED': ['ADMIN'],
};

export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  if (from === to) return true; // edit in-place
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function rolesForTransition(
  from: ContentStatus,
  to: ContentStatus,
): Array<'ADMIN' | 'EDITOR' | 'REVISOR'> | null {
  if (to === 'ARCHIVED') return ['ADMIN'];
  return TRANSITION_ROLES[`${from}->${to}`] ?? null;
}
