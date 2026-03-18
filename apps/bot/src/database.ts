import { createPrismaClient } from "@flowbot/db";
import { config } from "./config";

export const prismaClient = createPrismaClient(config.databaseUrl);
