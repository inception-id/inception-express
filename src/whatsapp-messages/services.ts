import { pg } from "../db/pg";
import { TABLES } from "../db/tables";
import { logger } from "../lib/logger";
import { WhatsappEnvironment } from "../whatsapp-notifications/services";

export type WhatsappMessage = {
  id: string;
  session_id: string;
  created_at: string;
  updated_at: string;
  target_phone: string;
  message_type: WhatsappEnvironment;
  text_message: string | null;
  country_code: string;
};

export const createWhatsappMessage = async (
  payload: Pick<
    WhatsappMessage,
    | "session_id"
    | "target_phone"
    | "text_message"
    | "message_type"
    | "country_code"
  >,
): Promise<WhatsappMessage[]> => {
  logger.info("createWhatsappMessage", payload);
  return await pg(TABLES.WHATSAPP_MESSAGES).insert(payload).returning("*");
};

export const countCurrentMonthWhatsappMessage = async (
  sessionIds: string[],
): Promise<{ message_type: WhatsappEnvironment; count: string }[]> => {
  logger.info("countCurrentMonthWhatsappMessage", { sessionIds });
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date(startOfMonth);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setMilliseconds(-1);
  return await pg(TABLES.WHATSAPP_MESSAGES)
    .select("message_type")
    .count("message_type as count")
    .whereIn("session_id", sessionIds)
    .andWhereBetween("created_at", [startOfMonth, endOfMonth])
    .groupBy("message_type");
};

type FindManyWhatsappMessagesPayload = {
  sessionIds: string[];
  offset: number;
  limit: number;
  environment?: WhatsappEnvironment;
};

export const findManyWhatsappMessages = async (
  payload: FindManyWhatsappMessagesPayload,
): Promise<WhatsappMessage[]> => {
  logger.info("findWhatsappMessages");
  if (payload.environment) {
    return await pg(TABLES.WHATSAPP_MESSAGES)
      .whereIn("session_id", payload.sessionIds)
      .andWhere("message_type", payload.environment)
      .offset(payload.offset)
      .limit(payload.limit)
      .orderBy("created_at", "desc")
      .returning("*");
  }
  return await pg(TABLES.WHATSAPP_MESSAGES)
    .whereIn("session_id", payload.sessionIds)
    .offset(payload.offset)
    .limit(payload.limit)
    .orderBy("created_at", "desc")
    .returning("*");
};

export const countWhatsappMessages = async (
  payload: Pick<FindManyWhatsappMessagesPayload, "sessionIds" | "environment">,
): Promise<{ count: string }> => {
  logger.info("countWhatsappMessages");
  if (payload.environment) {
    return (await pg(TABLES.WHATSAPP_MESSAGES)
      .count("id")
      .whereIn("session_id", payload.sessionIds)
      .andWhere("message_type", payload.environment)
      .first()) as { count: string };
  }
  return (await pg(TABLES.WHATSAPP_MESSAGES)
    .count("id")
    .whereIn("session_id", payload.sessionIds)
    .first()) as { count: string };
};

export const countAllTimeWhatsappMessages = async (sessionIds: string[]) => {
  logger.info("countAllTimeWhatsappMessages");
  return pg(TABLES.WHATSAPP_MESSAGES)
    .select(
      pg.raw("EXTRACT(YEAR FROM created_at) AS year"),
      pg.raw("EXTRACT(MONTH FROM created_at) AS month"),
      pg.raw("COUNT(id) AS count"),
      pg.raw("message_type AS environment"),
    )
    .whereIn("session_id", sessionIds)
    .groupByRaw("year, month, message_type")
    .orderByRaw("year, month desc")
    .returning("*");
};
