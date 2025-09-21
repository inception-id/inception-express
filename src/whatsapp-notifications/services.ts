import { pg } from "../db/pg";
import { TABLES } from "../db/tables";
import { logger } from "../lib/logger";
import { WhatsappEnvironment, WhatsappStatus } from "../lib/types";

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

type CreateParam = Pick<
  WhatsappNotification,
  | "session_id"
  | "user_id"
  | "target_phone"
  | "text_message"
  | "environment"
  | "country_code"
  | "status"
>;

export const create = async (
  payload: CreateParam | CreateParam[],
): Promise<WhatsappNotification[]> => {
  logger.info("[wa-notif-create]");
  return await pg(TABLES.WHATSAPP_NOTIFICATIONS).insert(payload).returning("*");
};

type FindManyParams = Partial<
  Pick<
    WhatsappNotification,
    | "session_id"
    | "user_id"
    | "target_phone"
    | "text_message"
    | "environment"
    | "country_code"
    | "status"
  >
>;

const findMany = async (
  param: FindManyParams,
  offset?: number,
  limit?: number,
): Promise<WhatsappNotification[]> => {
  logger.info("[wa-notif-findMany]");
  const query = pg(TABLES.WHATSAPP_NOTIFICATIONS).where({ ...param });
  if (typeof offset === "number") {
    query.offset(offset);
  }
  if (typeof limit === "number") {
    query.limit(limit);
  }
  query.orderBy("created_at", "desc");
  return await query.returning("*");
};

type UpdateFilterParams = Partial<
  Pick<
    WhatsappNotification,
    | "id"
    | "session_id"
    | "user_id"
    | "target_phone"
    | "text_message"
    | "environment"
    | "country_code"
    | "status"
  >
>;
type UpdateParams = Partial<
  Omit<WhatsappNotification, "id" | "created_at" | "updated_at">
>;

const update = async (
  filter: UpdateFilterParams,
  params: UpdateParams,
): Promise<WhatsappNotification[]> => {
  logger.info("[wa-notif-update]");
  return await pg(TABLES.WHATSAPP_NOTIFICATIONS)
    .where({ ...filter })
    .update({ ...params })
    .returning("*");
};

const count = async (params: FindManyParams): Promise<{ count: string }> => {
  logger.info("[wa-notif-count]");
  const notifCount = await pg(TABLES.WHATSAPP_NOTIFICATIONS)
    .count("id")
    .where({ ...params })
    .first();
  return notifCount as { count: string };
};

const countCurrentMonth = async (userId: string) => {
  logger.info("[wa-notif-countCurrentMonth]");
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

const countAllTime = async (userId: string) => {
  logger.info("[wa-notif-countAllTime]");
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

export const services = {
  create,
  findMany,
  update,
  count,
  countCurrentMonth,
  countAllTime,
};
