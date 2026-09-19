import { createHash } from "crypto";
import type { CanonicalExecutionRow } from "@/lib/brokers/adapter";

export interface FingerprintInput {
  brokerAccountId: string;
  exchange: string;
  brokerTradeId: string;
  brokerOrderId: string;
  executedAt: Date;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
}

/**
 * sha256(brokerAccountId, exchange, tradeId, orderId, timestamp, symbol,
 * side, quantity, price) — matches the spec's duplicate-fingerprint
 * definition exactly. Two executions with the same fingerprint are the
 * same broker fill; a re-import of an overlapping file must not create a
 * second Execution row.
 */
export function computeFingerprint(input: FingerprintInput): string {
  const parts = [
    input.brokerAccountId,
    input.exchange,
    input.brokerTradeId,
    input.brokerOrderId,
    input.executedAt.toISOString(),
    input.symbol,
    input.side,
    String(input.quantity),
    String(input.price),
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function fingerprintForCanonicalRow(
  brokerAccountId: string,
  row: CanonicalExecutionRow
): string {
  return computeFingerprint({
    brokerAccountId,
    exchange: row.exchange,
    brokerTradeId: row.brokerTradeId,
    brokerOrderId: row.brokerOrderId,
    executedAt: row.executedAt,
    symbol: row.symbol,
    side: row.side,
    quantity: row.quantity,
    price: row.price,
  });
}
