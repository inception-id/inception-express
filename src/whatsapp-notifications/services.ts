import { pg } from "../db/pg";
import { TABLES } from "../db/tables";
import { logger } from "../lib/logger";

export enum WhatsappEnvironment {
  Development = "DEVELOPMENT",
  Production = "PRODUCTION",
}

export enum WhatsappStatus {
  Pending = "PENDING",
  Delivered = "DELIVERED",
  Failed = "FAILED",
}

export type WhatsappNotification = {
  id: string;
  session_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  target_phone: string;
  text_message: string | null;
  environment: WhatsappEnvironment;
  country_code: string;
  status?: WhatsappStatus;
};

type CreateWhatsappNotificationPayload = Pick<
  WhatsappNotification,
  | "session_id"
  | "user_id"
  | "target_phone"
  | "text_message"
  | "environment"
  | "country_code"
  | "status"
>;

export const createWhatsappNotification = async (
  payload:
    | CreateWhatsappNotificationPayload
    | CreateWhatsappNotificationPayload[],
): Promise<WhatsappNotification[]> => {
  logger.info("[createWhatsappNotification]");
  return await pg(TABLES.WHATSAPP_NOTIFICATIONS).insert(payload).returning("*");
};

export const countCurrentMonthWhatsappNotifications = async (
  userId: string,
): Promise<{ environment: WhatsappEnvironment; count: string }[]> => {
  logger.info("countCurrentMonthWhatsappNotification");
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date(startOfMonth);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setMilliseconds(-1);

  return await pg(TABLES.WHATSAPP_NOTIFICATIONS)
    .select("environment")
    .count("environment as count")
    .where("user_id", userId)
    .andWhereBetween("created_at", [startOfMonth, endOfMonth])
    .groupBy("environment");
};

type FindManyWhatsappNotificationPayload = {
  userId: string;
  offset: number;
  limit: number;
  environment?: WhatsappEnvironment;
};

export const findManyWhatsappNotifications = async (
  payload: FindManyWhatsappNotificationPayload,
): Promise<WhatsappNotification[]> => {
  logger.info("findWhatsappNotifications");
  if (payload.environment) {
    return await pg(TABLES.WHATSAPP_NOTIFICATIONS)
      .where("user_id", payload.userId)
      .andWhere("environment", payload.environment)
      .offset(payload.offset)
      .limit(payload.limit)
      .orderBy("created_at", "desc")
      .returning("*");
  }
  return await pg(TABLES.WHATSAPP_NOTIFICATIONS)
    .where("user_id", payload.userId)
    .offset(payload.offset)
    .limit(payload.limit)
    .orderBy("created_at", "desc")
    .returning("*");
};

type FindAllParams = Pick<WhatsappNotification, "status">;

export const findManyWaNotifications = async (
  params: FindAllParams,
): Promise<WhatsappNotification[]> => {
  return await pg(TABLES.WHATSAPP_NOTIFICATIONS)
    .where({ ...params })
    .orderBy("created_at", "desc")
    .returning("*");
};

type UpdateFilterParams = Pick<WhatsappNotification, "id">;
type UpdateParams = Pick<WhatsappNotification, "status">;

export const updateWaNotifications = async (
  filter: UpdateFilterParams,
  params: FindAllParams,
): Promise<WhatsappNotification[]> => {
  return await pg(TABLES.WHATSAPP_NOTIFICATIONS)
    .where({ ...filter })
    .update({ ...params })
    .returning("*");
};

export const countWhatsappNotifications = async (
  payload: Pick<FindManyWhatsappNotificationPayload, "userId" | "environment">,
): Promise<{ count: string }> => {
  logger.info("countWhatsappNotifications");
  if (payload.environment) {
    return (await pg(TABLES.WHATSAPP_NOTIFICATIONS)
      .count("id")
      .where("user_id", payload.userId)
      .andWhere("environment", payload.environment)
      .first()) as { count: string };
  }
  return (await pg(TABLES.WHATSAPP_NOTIFICATIONS)
    .count("id")
    .where("user_id", payload.userId)
    .first()) as { count: string };
};

export const countAllTimeWhatsappNotifications = async (userId: string) => {
  logger.info("countAllTimeWhatsappNotifications");
  return pg(TABLES.WHATSAPP_NOTIFICATIONS)
    .select(
      pg.raw("EXTRACT(YEAR FROM created_at) AS year"),
      pg.raw("EXTRACT(MONTH FROM created_at) AS month"),
      pg.raw("COUNT(id) AS count"),
      pg.raw("environment"),
    )
    .where("user_id", userId)
    .groupByRaw("year, month, environment")
    .orderByRaw("year, month desc")
    .returning("*");
};
