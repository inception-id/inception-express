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

type FindManyWhatsappNotificationPayload = {
  userId: string;
  offset: number;
  limit: number;
  environment?: WhatsappEnvironment;
};

export const findManyWhatsappNotifications = async (
  payload: FindManyWhatsappNotificationPayload,
): Promise<WhatsappNotification[]> => {
  logger.info("findWhatsappNotifications");
  try {
    if (payload.environment) {
      return await pg(TABLES.WHATSAPP_NOTIFICATIONS)
        .where("user_id", payload.userId)
        .andWhere("environment", payload.environment)
        .offset(payload.offset)
        .limit(payload.limit)
        .orderBy("created_at", "desc")
        .returning("*");
    }
    return await pg(TABLES.WHATSAPP_NOTIFICATIONS)
      .where("user_id", payload.userId)
      .offset(payload.offset)
      .limit(payload.limit)
      .orderBy("created_at", "desc")
      .returning("*");
  } catch (error) {
    logger.error("findWhatsapsNotifications", error);
    return [];
  }
};

export const countWhatsappNotifications = async (
  payload: Pick<FindManyWhatsappNotificationPayload, "userId" | "environment">,
): Promise<{ count: string }> => {
  logger.info("countWhatsappNotifications");
  try {
    if (payload.environment) {
      return (await pg(TABLES.WHATSAPP_NOTIFICATIONS)
        .count("id")
        .where("user_id", payload.userId)
        .andWhere("environment", payload.environment)
        .first()) as { count: string };
    }
    return (await pg(TABLES.WHATSAPP_NOTIFICATIONS)
      .count("id")
      .where("user_id", payload.userId)
      .first()) as { count: string };
  } catch (error) {
    logger.error("countWhatsappNotifications", error);
    throw error;
  }
};
