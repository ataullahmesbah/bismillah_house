-- Accounts created through Google have no password to check.
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Google's stable subject id, so a linked account survives an email change.
ALTER TABLE "users" ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
