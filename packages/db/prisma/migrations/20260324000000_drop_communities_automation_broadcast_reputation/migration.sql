-- DropTable (Communities)
DROP TABLE IF EXISTS "CommunityAnalyticsSnapshot";
DROP TABLE IF EXISTS "CommunityMember";
DROP TABLE IF EXISTS "CommunityDiscordConfig";
DROP TABLE IF EXISTS "CommunityTelegramConfig";
DROP TABLE IF EXISTS "CommunityConfig";
DROP TABLE IF EXISTS "Community";

-- DropTable (Automation)
DROP TABLE IF EXISTS "BroadcastMessage";
DROP TABLE IF EXISTS "ClientLog";
DROP TABLE IF EXISTS "ClientSession";
DROP TABLE IF EXISTS "CrossPostTemplate";

-- DropTable (Reputation)
DROP TABLE IF EXISTS "ReputationScore";

-- AlterTable (PlatformAccount - remove community fields)
ALTER TABLE "PlatformAccount" DROP COLUMN IF EXISTS "lastCommunityId";
