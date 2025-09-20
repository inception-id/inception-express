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
  is_deleted: boolean;
  hourly_limit: number;
  daily_limit: number;
};

export const createWhatsappSession = async (
  userId: string,
  phone: string,
): Promise<WhatsappSession[]> => {
  logger.info("createWhatsappSession", { userId, phone });
  return await pg(TABLES.WHATSAPP_SESSIONS)
    .insert({
      user_id: userId,
      phone,
      is_ready: false,
    })
    .returning("*");
};

export const updateWhatsappSession = async (
  id: string,
  payload: Partial<
    Pick<
      WhatsappSession,
      "phone" | "is_ready" | "is_deleted" | "hourly_limit" | "daily_limit"
    >
  >,
): Promise<WhatsappSession[]> => {
  logger.info("updateWhatsappSession", { id, payload });
  return await pg(TABLES.WHATSAPP_SESSIONS)
    .update({
      ...payload,
    })
    .where({ id })
    .returning("*");
};

type WhatsappSessionSearchKey = Partial<
  Pick<WhatsappSession, "id" | "user_id" | "phone" | "is_ready" | "is_deleted">
>;

export const findManyWhatsappSessions = async (
  searchKeys: WhatsappSessionSearchKey,
): Promise<WhatsappSession[]> => {
  logger.info("findWhatsappSessions", { ...searchKeys });
  return await pg(TABLES.WHATSAPP_SESSIONS)
    .where({ ...searchKeys })
    .orderBy("created_at", "desc")
    .returning("*");
};

export const findOneWhatsappSession = async (
  searchKeys: WhatsappSessionSearchKey,
): Promise<WhatsappSession | null> => {
  logger.info("findOneWhatsappSession", { ...searchKeys });
  return await pg(TABLES.WHATSAPP_SESSIONS)
    .where({ ...searchKeys })
    .orderBy("created_at", "desc")
    .first();
};

export const findManyWhatsappSessionsBySessionIds = async (
  sessionIds: string[],
): Promise<WhatsappSession[]> => {
  logger.info("findManyWhatsappSessionsBySessionIds");
  return await pg(TABLES.WHATSAPP_SESSIONS)
    .whereIn("id", sessionIds)
    .andWhere("is_deleted", false)
    .orderBy("created_at", "desc")
    .returning("*");
};

export const deleteWhatsappSession = async (
  sessionId: string,
  userId: string,
): Promise<WhatsappSession[] | null> => {
  logger.info("deleteWhatsappSession", { sessionId, userId });
  return await pg(TABLES.WHATSAPP_SESSIONS)
    .update({
      is_deleted: true,
    })
    .where({ id: sessionId, user_id: userId })
    .returning("*");
};
