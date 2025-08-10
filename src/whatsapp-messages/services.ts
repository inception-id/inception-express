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
    "session_id" | "target_phone" | "text_message"
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
