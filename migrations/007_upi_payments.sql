-- Migration 007: upi_payments
-- Records order quote requests and UPI payment confirmations submitted from the
-- order flow. Previously api/upi-payment.js only console.log'd these, so a
-- customer's UTR was lost unless someone grepped the logs.

CREATE TABLE IF NOT EXISTS upi_payments (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      VARCHAR(120) NOT NULL,
  plan_label    VARCHAR(200),
  amount        NUMERIC(12,2),
  customer_name VARCHAR(200),
  upi_id        VARCHAR(120),
  utr           VARCHAR(80),
  kind          VARCHAR(20)  NOT NULL DEFAULT 'payment'  -- 'payment' | 'quote'
                 CHECK (kind IN ('payment','quote')),
  status        VARCHAR(20)  NOT NULL DEFAULT 'received',
  ip_hash       VARCHAR(16),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upi_payments_order   ON upi_payments (order_id);
CREATE INDEX IF NOT EXISTS idx_upi_payments_created ON upi_payments (created_at DESC);
-- One UTR should only ever land once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_upi_payments_utr
  ON upi_payments (utr) WHERE utr IS NOT NULL AND utr <> '';

INSERT INTO schema_migrations (version, description)
VALUES (7, 'upi_payments')
ON CONFLICT (version) DO NOTHING;
