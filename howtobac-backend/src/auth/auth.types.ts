import type { Request } from 'express';
import type { PublicUser } from '../users/public-user.js';

/** The signed-in user, loaded fresh from the DB on every request by JwtAuthGuard. */
export type AuthUser = PublicUser;

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
