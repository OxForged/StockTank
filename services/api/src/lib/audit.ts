import type { Request } from 'express';
import type { Prisma, PrismaClient } from '@stocktank/database';
import { getRequestId } from './logger.js';

export type AuditAction =
  | 'auth.register'
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.logout'
  | 'auth.dev_login'
  | 'user.roles.update'
  | `advertising.${string}`
  | `content.${string}`
  | 'newsletter.export'
  | 'feature_flag.update';

export interface AuditEntry {
  action: AuditAction;
  actorId: string | null;
  targetType?: string;
  targetId?: string;
  /** Must never contain passwords, tokens or raw email addresses. */
  metadata?: Prisma.InputJsonObject;
}

type AuditClient = Pick<PrismaClient, 'auditLog'> | Prisma.TransactionClient;

/** Writes one audit row, tagging it with the request's ip and id. */
export async function writeAudit(db: AuditClient, req: Request, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      action: entry.action,
      actorId: entry.actorId,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? undefined,
      ipAddress: req.ip ?? null,
      requestId: getRequestId(req),
    },
  });
}
