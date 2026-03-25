/**
 * Prisma client singleton for converter service
 */

import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

/**
 * Get or create Prisma client
 */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

/**
 * Close Prisma connection
 */
export async function closePrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
