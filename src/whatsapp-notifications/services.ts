import { pg } from "../db/pg";
import { TABLES } from "../db/tables";
import { logger } from "../lib/logger";

export enum WhatsappEnvironment {
  Development = "DEVELOPMENT",
  Production = "PRODUCTION",
}

export type WhatsappNotification = {
  id: string;
  session_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  target_phone: string;
  text_message: string | null;
  environment: WhatsappEnvironment;
};

export const createWhatsappNotification = async (
  payload: Pick<
    WhatsappNotification,
    "session_id" | "user_id" | "target_phone" | "text_message" | "environment"
  >,
): Promise<WhatsappNotification[]> => {
  logger.info("createWhatsappNotification", payload);
  try {
    return await pg(TABLES.WHATSAPP_NOTIFICATIONS)
      .insert(payload)
      .returning("*");
  } catch (error) {
    logger.error("createWhatsappNotification", error);
    throw error;
  }
};

export const countCurrentMonthWhatsappNotifications = async (
  userId: string,
): Promise<{ environment: WhatsappEnvironment; count: string }[]> => {
  logger.info("countCurrentMonthWhatsappNotification");
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setMilliseconds(-1);

    return await pg(TABLES.WHATSAPP_NOTIFICATIONS)
      .select("environment")
      .count("environment as count")
      .where("user_id", userId)
      .andWhereBetween("created_at", [startOfMonth, endOfMonth])
      .groupBy("environment");
  } catch (error) {
    logger.error("countCurrentMonthWhatsappNotification", error);
    throw error; // Do not return any default here or we lost our profit
  }
};
