import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import type { SubjectAction } from '../access-policy.js';
import { SubjectAccessGuard } from '../guards/subject-access.guard.js';

export const SUBJECT_ACCESS_KEY = 'subjectAccess';

export interface SubjectAccessRule {
  action: SubjectAction;
  /** Route param holding the subject, e.g. 'subject' for `/lessons/:subject`. */
  param: string;
}

/**
 * Requires the current user to have `action` rights on the subject in the
 * given route param.
 *
 * @example
 * @Patch(':subject/lessons/:id')
 * @SubjectAccess('edit')
 */
export const SubjectAccess = (action: SubjectAction, param = 'subject') =>
  applyDecorators(
    SetMetadata(SUBJECT_ACCESS_KEY, {
      action,
      param,
    } satisfies SubjectAccessRule),
    UseGuards(SubjectAccessGuard),
  );
