CREATE UNIQUE INDEX IF NOT EXISTS "ReviewItem_ownerKey_phoneHash_reason_open_key" ON "ReviewItem"("ownerKey", "phoneHash", "reason") WHERE "status" = 'open';
