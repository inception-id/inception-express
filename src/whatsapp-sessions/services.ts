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

type WhatsappSessionSearchKey = Partial<
  Pick<WhatsappSession, "id" | "user_id" | "phone" | "is_ready">
>;

export const findManyWhatsappSessions = async (
  searchKeys: WhatsappSessionSearchKey,
): Promise<WhatsappSession[]> => {
  logger.info("findWhatsappSessions", { ...searchKeys });
  try {
    return await pg(TABLES.WHATSAPP_SESSIONS)
      .where({ ...searchKeys })
      .orderBy("created_at", "desc")
      .returning("*");
  } catch (error) {
    logger.error("findWhatsappSessions", error);
    return [];
  }
};

export const findOneWhatsappSession = async (
  searchKeys: WhatsappSessionSearchKey,
): Promise<WhatsappSession | null> => {
  logger.info("findOneWhatsappSession", { ...searchKeys });
  try {
    return await pg(TABLES.WHATSAPP_SESSIONS)
      .where({ ...searchKeys })
      .orderBy("created_at", "desc")
      .first();
  } catch (error) {
    logger.error("findOneWhatsappSession", error);
    return null;
  }
};

export const deleteWhatsappSession = async (
  sessionId: string,
  userId: string,
): Promise<WhatsappSession[] | null> => {
  logger.info("deleteWhatsappSession", { sessionId, userId });
  try {
    return await pg(TABLES.WHATSAPP_SESSIONS)
      .where({ id: sessionId, user_id: userId })
      .del()
      .returning("*");
  } catch (error) {
    logger.error("deleteWhatsappSession", error);
    return [];
  }
};
