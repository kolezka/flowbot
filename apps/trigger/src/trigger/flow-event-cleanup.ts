import { schedules } from '@trigger.dev/sdk/v3';
import { getPrisma } from '../lib/prisma.js';

export async function cleanupExpiredEvents(prisma: any): Promise<{ deletedCount: number }> {
  const result = await prisma.flowEvent.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return { deletedCount: result.count };
}

export const flowEventCleanupTask = schedules.task({
  id: 'flow-event-cleanup',
  cron: '0 3 * * *',
  run: async () => {
    const prisma = getPrisma();
    const result = await cleanupExpiredEvents(prisma);
    return result;
  },
});
