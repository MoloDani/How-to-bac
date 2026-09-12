import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { subjectParamSchema } from '../../common/subjects.js';
import { canAccessSubject } from '../access-policy.js';
import type { AuthenticatedRequest } from '../auth.types.js';
import {
  SUBJECT_ACCESS_KEY,
  type SubjectAccessRule,
} from '../decorators/subject-access.decorator.js';

/** Applied by @SubjectAccess(). Runs after the global JwtAuthGuard. */
@Injectable()
export class SubjectAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.get<SubjectAccessRule | undefined>(
      SUBJECT_ACCESS_KEY,
      context.getHandler(),
    );
    if (!rule) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const subject = subjectParamSchema.safeParse(req.params[rule.param]);
    if (!subject.success) throw new BadRequestException('invalid_subject');

    if (!canAccessSubject(req.user, rule.action, subject.data)) {
      throw new ForbiddenException('subject_access_denied');
    }
    return true;
  }
}
