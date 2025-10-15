import { pg } from "../db/pg";
import { TABLES } from "../db/tables";
import { logger } from "../lib/logger";

export enum WhatsappPaymentStatus {
  FAIL = "FAIL",
  PAID = "PAID",
  PENDING = "PENDING",
  FREE = "FREE",
}

export type WhatsappPaymentItem = {
  label: string;
  value: number;
};

export type WhatsappPayment = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  payment_status: WhatsappPaymentStatus;
  amount: number;
  items: string;
  doku_request: string | null;
  doku_response: string | null;
  paid_at: string | null;
  year: number | null;
  month: number | null;
  doku_notif: string | null;
};

type FindManyParams = Partial<
  Pick<WhatsappPayment, "user_id" | "payment_status">
>;

const findMany = async (
  param: FindManyParams,
  offset?: number,
  limit?: number,
): Promise<WhatsappPayment[]> => {
  logger.info("[wa-payment-findMany]");
  const query = pg(TABLES.WHATSAPP_PAYMENTS).where({ ...param });
  if (typeof offset === "number") {
    query.offset(offset);
  }
  if (typeof limit === "number") {
    query.limit(limit);
  }
  query.orderBy("created_at", "desc");
  return await query.returning("*");
};

const count = async (params: FindManyParams): Promise<{ count: string }> => {
  logger.info("[wa-payment-count]");
  const paymentCount = await pg(TABLES.WHATSAPP_PAYMENTS)
    .count("id")
    .where({ ...params })
    .first();
  return paymentCount as { count: string };
};

type CreateParam = Omit<WhatsappPayment, "id" | "created_at" | "updated_at">;

const create = async (
  payload: CreateParam | CreateParam[],
): Promise<WhatsappPayment[]> => {
  logger.info("[wa-payment-create]");
  return await pg(TABLES.WHATSAPP_PAYMENTS).insert(payload).returning("*");
};

// In Rupiah
const countPricePerWhatsapp = (totalWhatsapp: number) => {
  if (totalWhatsapp > 10000) {
    return 10;
  }
  if (totalWhatsapp > 5000) {
    return 20;
  }
  if (totalWhatsapp > 1000) {
    return 30;
  }
  if (totalWhatsapp > 500) {
    return 40;
  }
  return 50;
};

export const services = {
  findMany,
  count,
  create,
  countPricePerWhatsapp,
};
