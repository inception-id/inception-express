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
) => {
  logger.info("[countCurrentMonthWhatsappNotification]");
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date(startOfMonth);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setMilliseconds(-1);

  const notifCount = await pg(TABLES.WHATSAPP_NOTIFICATIONS)
    .count()
    .where("user_id", userId)
    .andWhereBetween("created_at", [startOfMonth, endOfMonth])
    .first();
  return notifCount as { count: string };
};

type FindManyWithPaginationParams = Partial<
  Pick<WhatsappNotification, "user_id" | "environment" | "status">
>;

export const findManyWhatsappNotificationsWithPagination = async (
  param: FindManyWithPaginationParams,
  offset: number,
  limit: number,
): Promise<WhatsappNotification[]> => {
  logger.info("[findManyWhatsappNotificationsWithPagination]");
  return await pg(TABLES.WHATSAPP_NOTIFICATIONS)
    .where({ ...param })
    .offset(offset)
    .limit(limit)
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
  payload: Omit<FindManyWithPaginationParams, "offset" | "limit">,
): Promise<{ count: string }> => {
  logger.info("countWhatsappNotifications");
  return (await pg(TABLES.WHATSAPP_NOTIFICATIONS)
    .count("id")
    .where({ ...payload })
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
