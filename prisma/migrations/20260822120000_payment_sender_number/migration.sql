-- Wallet the customer paid from, so staff can reconcile a bKash statement
-- line against an order without contacting them.
ALTER TABLE "payments" ADD COLUMN "senderNumber" TEXT;
