-- Internal staff-to-staff tickets.
CREATE TYPE "TokenCategory" AS ENUM ('ORDER', 'PAYMENT', 'PRODUCT', 'CUSTOMER', 'DELIVERY', 'TECHNICAL', 'OTHER');
CREATE TYPE "TokenPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "TokenStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TokenCategory" NOT NULL DEFAULT 'OTHER',
    "priority" "TokenPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TokenStatus" NOT NULL DEFAULT 'OPEN',
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "token_assignees" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "token_assignees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "token_comments" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_comments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tokens_reference_key" ON "tokens"("reference");
CREATE INDEX "tokens_status_createdAt_idx" ON "tokens"("status", "createdAt");
CREATE INDEX "tokens_createdById_idx" ON "tokens"("createdById");
CREATE UNIQUE INDEX "token_assignees_tokenId_userId_key" ON "token_assignees"("tokenId", "userId");
CREATE INDEX "token_assignees_userId_idx" ON "token_assignees"("userId");
CREATE INDEX "token_comments_tokenId_createdAt_idx" ON "token_comments"("tokenId", "createdAt");

ALTER TABLE "tokens" ADD CONSTRAINT "tokens_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "token_assignees" ADD CONSTRAINT "token_assignees_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "token_assignees" ADD CONSTRAINT "token_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "token_comments" ADD CONSTRAINT "token_comments_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "token_comments" ADD CONSTRAINT "token_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reference numbers come from a sequence so two concurrent creates cannot collide.
CREATE SEQUENCE IF NOT EXISTS token_reference_seq START 1;
