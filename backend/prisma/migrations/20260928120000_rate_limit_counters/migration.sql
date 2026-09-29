-- Rate-limit counters shared by every API instance (middlewares/rateLimitStore.ts).
CREATE TABLE "rate_limit_counters" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "reset_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "rate_limit_counters_reset_at_idx" ON "rate_limit_counters"("reset_at");
