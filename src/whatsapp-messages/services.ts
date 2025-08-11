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
  logger.info("createWhatsappSession", payload);
  try {
    return await pg(TABLES.WHATSAPP_MESSAGES).insert(payload).returning("*");
  } catch (error) {
    logger.error("createWhatsappSession", error);
    return [];
  }
};

export const countCurrentMonthWhatsappMessage = async (): Promise<
  { message_type: WhatsappMessageType; count: string }[]
> => {
  logger.info("countCurrentMonthWhatsappMessage");
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
      .whereBetween("created_at", [startOfMonth, endOfMonth])
      .groupBy("message_type");
  } catch (error) {
    logger.error("countCurrentMonthWhatsappMessage", error);
    throw error; // Do not return any default here or we lost our profit
  }
};
