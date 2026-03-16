interface PrismaLike {
  userFlowContext: {
    findUnique: (args: any) => Promise<any>
    upsert: (args: any) => Promise<any>
    delete: (args: any) => Promise<any>
    findMany: (args: any) => Promise<any[]>
  }
}

export async function getContext(
  prisma: PrismaLike,
  platformUserId: string,
  platform: string,
  key: string,
  defaultValue?: unknown,
): Promise<unknown> {
  const record = await prisma.userFlowContext.findUnique({
    where: {
      platformUserId_platform_key: { platformUserId, platform, key },
    },
  })
  return record ? record.value : defaultValue
}

export async function setContext(
  prisma: PrismaLike,
  platformUserId: string,
  platform: string,
  key: string,
  value: unknown,
): Promise<void> {
  await prisma.userFlowContext.upsert({
    where: {
      platformUserId_platform_key: { platformUserId, platform, key },
    },
    update: { value },
    create: { platformUserId, platform, key, value },
  })
}

export async function deleteContext(
  prisma: PrismaLike,
  platformUserId: string,
  platform: string,
  key: string,
): Promise<void> {
  try {
    await prisma.userFlowContext.delete({
      where: {
        platformUserId_platform_key: { platformUserId, platform, key },
      },
    })
  } catch (err: any) {
    if (err?.code === 'P2025') return
    throw err
  }
}

export async function listContextKeys(
  prisma: PrismaLike,
  platformUserId: string,
  platform: string,
): Promise<Array<{ key: string; value: unknown }>> {
  const records = await prisma.userFlowContext.findMany({
    where: { platformUserId, platform },
    select: { key: true, value: true },
  })
  return records
}
