import { pg } from "../db/pg";
import { TABLES } from "../db/tables";
import { logger } from "../lib/logger";

export enum WhatsappMessageType {
  Development = "DEVELOPMENT",
  Production = "PRODUCTION",
}

export type WhatsappMessage = {
  id: string;
  session_id: string;
  created_at: string;
  updated_at: string;
  target_phone: string;
  message_type: WhatsappMessageType;
  text_message: string | null;
};

export const createWhatsappMessage = async (
  payload: Pick<
    WhatsappMessage,
    "session_id" | "target_phone" | "text_message" | "message_type"
  >,
): Promise<WhatsappMessage[]> => {
  logger.info("createWhatsappMessage", payload);
  try {
    return await pg(TABLES.WHATSAPP_MESSAGES).insert(payload).returning("*");
  } catch (error) {
    logger.error("createWhatsappMessage", error);
    return [];
  }
};

export const countCurrentMonthWhatsappMessage = async (
  sessionIds: string[],
): Promise<{ message_type: WhatsappMessageType; count: string }[]> => {
  logger.info("countCurrentMonthWhatsappMessage", { sessionIds });
  try {
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
  } catch (error) {
    logger.error("countCurrentMonthWhatsappMessage", error);
    throw error; // Do not return any default here or we lost our profit
  }
};

type FindManyWhatsappMessagesPayload = {
  sessionIds: string[];
  offset: number;
  limit: number;
  environment?: WhatsappMessageType;
};

export const findManyWhatsappMessages = async (
  payload: FindManyWhatsappMessagesPayload,
): Promise<WhatsappMessage[]> => {
  logger.info("findWhatsappMessages");
  try {
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
  } catch (error) {
    logger.error("findWhatsapsMessages", error);
    return [];
  }
};

export const countWhatsappMessages = async (
  payload: Pick<FindManyWhatsappMessagesPayload, "sessionIds" | "environment">,
): Promise<{ count: string }> => {
  logger.info("countWhatsappMessages");
  try {
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
  } catch (error) {
    logger.error("countWhatsapsMessages", error);
    throw error;
  }
};

// SELECT
//     EXTRACT(YEAR FROM created_at) AS year,
//     EXTRACT(MONTH FROM created_at) AS month,
// 		message_type,
//     COUNT(*) AS total_records
// FROM
//     whatsapp_messages
// GROUP BY
//     EXTRACT(YEAR FROM created_at),
//     EXTRACT(MONTH FROM created_at),
// 		message_type
// ORDER BY
//     year, month desc;
