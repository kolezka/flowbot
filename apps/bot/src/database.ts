import { createPrismaClient } from "@tg-allegro/db";
import { config } from "./config";

export const prismaClient = createPrismaClient(config.databaseUrl);
