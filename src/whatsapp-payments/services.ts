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
  items: WhatsappPaymentItem[] | string;
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

const findMany = async (param: FindManyParams): Promise<WhatsappPayment[]> => {
  logger.info("[wa-payment-findMany]");
  const query = await pg(TABLES.WHATSAPP_PAYMENTS)
    .where({ ...param })
    .orderBy("created_at", "desc")
    .returning("*");
  return query;
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

type FindOneParams = Partial<
  Omit<WhatsappPayment, "created_at" | "updated_at">
>;

export const find = async (
  params: FindOneParams,
): Promise<WhatsappPayment | null> => {
  logger.info("[wa-payment-find]");
  return await pg(TABLES.WHATSAPP_PAYMENTS)
    .where(params)
    .orderBy("created_at", "desc")
    .first();
};

type UpdateFilterParams = Partial<Pick<WhatsappPayment, "id">>;
type UpdateParams = Partial<
  Omit<WhatsappPayment, "id" | "user_id" | "created_at" | "updated_at">
>;

const update = async (
  filter: UpdateFilterParams,
  params: UpdateParams,
): Promise<WhatsappPayment[]> => {
  logger.info("[wa-payment-update]");
  return await pg(TABLES.WHATSAPP_PAYMENTS)
    .where({ ...filter })
    .update({ ...params })
    .returning("*");
};

export const services = {
  findMany,
  find,
  create,
  countPricePerWhatsapp,
  update,
};
