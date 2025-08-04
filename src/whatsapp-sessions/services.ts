import { pg } from "../db/pg";
import { TABLES } from "../db/tables";

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
    console.error("createWhatsappSession", error);
    return [];
  }
};
