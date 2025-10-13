import { pg } from "../db/pg";
import { TABLES } from "../db/tables";
import { logger } from "../lib/logger";
import { WhatsappEnvironment } from "../lib/types";
import { WhatsappStatus } from "../lib/types";

export type WhatsappMessage = {
  id: string;
  session_id: string;
  created_at: string;
  updated_at: string;
  target_phone: string;
  text_message: string | null;
  environment: WhatsappEnvironment;
  country_code: string;
  status: WhatsappStatus | null;
  media_url: string | null;
};

type CreateParam = Pick<
  WhatsappMessage,
  | "session_id"
  | "target_phone"
  | "text_message"
  | "environment"
  | "country_code"
  | "status"
  | "media_url"
>;

const create = async (
  payload: CreateParam | CreateParam[],
): Promise<WhatsappMessage[]> => {
  logger.info("[wa-message-create]");
  return await pg(TABLES.WHATSAPP_MESSAGES).insert(payload).returning("*");
};

type FindManyParams = Partial<
  Pick<
    WhatsappMessage,
    | "session_id"
    | "target_phone"
    | "text_message"
    | "environment"
    | "country_code"
    | "status"
  >
>;

const findMany = async (params: FindManyParams): Promise<WhatsappMessage[]> => {
  logger.info("[wa-message-findMany]");

  return await pg(TABLES.WHATSAPP_MESSAGES)
    .where(params)
    .orderBy("created_at", "desc")
    .returning("*");
};

const findManyBySessionIds = async (
  sessionIds: string[],
  params?: FindManyParams,
  offset?: number,
  limit?: number,
): Promise<WhatsappMessage[]> => {
  logger.info("[wa-message-findManyBySessionIds]");

  const query = pg(TABLES.WHATSAPP_MESSAGES).whereIn("session_id", sessionIds);
  if (params && Object.keys(params).length > 0) {
    query.andWhere({ ...params });
  }
  if (typeof offset === "number") {
    query.offset(offset);
  }
  if (typeof limit === "number") {
    query.limit(limit);
  }
  query.orderBy("created_at", "desc");
  return await query.returning("*");
};

const count = async (
  sessionIds: string[],
  params?: FindManyParams,
): Promise<{ count: string }> => {
  logger.info("[wa-message-count]");

  const query = pg(TABLES.WHATSAPP_MESSAGES)
    .count()
    .whereIn("session_id", sessionIds);
  if (params && Object.keys(params).length > 0) {
    query.andWhere({ ...params });
  }

  return (await query.first()) as { count: string };
};

const countCurrentMonth = async (
  sessionIds: string[],
): Promise<{ count: string }> => {
  logger.info("[wa-message-countCurrentMonth]");

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date(startOfMonth);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setMilliseconds(-1);

  const msgCount = await pg(TABLES.WHATSAPP_MESSAGES)
    .count()
    .whereIn("session_id", sessionIds)
    .andWhereBetween("created_at", [startOfMonth, endOfMonth])
    .first();
  return msgCount as { count: string };
};

const countAllTime = async (sessionIds: string[]) => {
  logger.info("[wa-message-countAllTime]");
  return pg(TABLES.WHATSAPP_MESSAGES)
    .select(
      pg.raw("EXTRACT(YEAR FROM created_at) AS year"),
      pg.raw("EXTRACT(MONTH FROM created_at) AS month"),
      pg.raw("COUNT(id) AS count"),
      pg.raw("environment"),
    )
    .whereIn("session_id", sessionIds)
    .groupByRaw("year, month, environment")
    .orderByRaw("year, month desc")
    .returning("*");
};

type UpdateFilter = Partial<
  Pick<
    WhatsappMessage,
    | "id"
    | "session_id"
    | "target_phone"
    | "text_message"
    | "status"
    | "environment"
  >
>;

type UpdateParams = Partial<
  Pick<
    WhatsappMessage,
    | "session_id"
    | "target_phone"
    | "text_message"
    | "status"
    | "environment"
    | "media_url"
  >
>;

const update = async (
  filter: UpdateFilter,
  params: UpdateParams,
): Promise<WhatsappMessage[]> => {
  logger.info("[wa-message-update]");
  return await pg(TABLES.WHATSAPP_MESSAGES)
    .where(filter)
    .update(params)
    .returning("*");
};

export const services = {
  create,
  findMany,
  findManyBySessionIds,
  count,
  countAllTime,
  countCurrentMonth,
  update,
};
