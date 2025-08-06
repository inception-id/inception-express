import { pg } from "../db/pg";
import { TABLES } from "../db/tables";
import { logger } from "../lib/logger";

export type WhatsappSession = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  phone: string;
  is_ready: boolean;
};

export const createWhatsappSession = async (
  userId: string,
  phone: string,
): Promise<WhatsappSession[]> => {
  logger.info("createWhatsappSession", { userId, phone });
  try {
    return await pg(TABLES.WHATSAPP_SESSIONS)
      .insert({
        user_id: userId,
        phone,
        is_ready: false,
      })
      .where({ user_id: userId, phone })
      .returning("*");
  } catch (error) {
    logger.error("createWhatsappSession", error);
    return [];
  }
};

export const updateWhatsappSession = async (
  id: string,
  payload: Partial<Pick<WhatsappSession, "phone" | "is_ready">>,
): Promise<WhatsappSession[]> => {
  logger.info("updateWhatsappSession", { id, payload });
  try {
    return await pg(TABLES.WHATSAPP_SESSIONS)
      .update({
        ...payload,
      })
      .where({ id })
      .returning("*");
  } catch (error) {
    logger.error("updateWhatsappSession", error);
    return [];
  }
};
