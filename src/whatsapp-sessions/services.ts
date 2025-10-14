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
  is_disconnected: boolean;
};

type CreateParams = Partial<
  Omit<WhatsappSession, "id" | "created_at" | "updated_at">
>;

const create = async (params: CreateParams): Promise<WhatsappSession[]> => {
  logger.info("[wa-session-create]");
  return await pg(TABLES.WHATSAPP_SESSIONS).insert(params).returning("*");
};

type UpdateParams = Partial<Omit<WhatsappSession, "created_at" | "updated_at">>;

export const update = async (
  filter: UpdateParams,
  params: UpdateParams,
): Promise<WhatsappSession[]> => {
  logger.info("[wa-session-update]");
  return await pg(TABLES.WHATSAPP_SESSIONS)
    .where(filter)
    .update(params)
    .returning("*");
};

type FindManyParams = Partial<
  Omit<WhatsappSession, "id" | "created_at" | "updated_at" | "phone">
>;

const findMany = async (params: FindManyParams): Promise<WhatsappSession[]> => {
  logger.info("[wa-session-findMany]");
  return await pg(TABLES.WHATSAPP_SESSIONS)
    .where(params)
    .orderBy("created_at", "desc")
    .returning("*");
};

type FindOneParams = Partial<
  Omit<WhatsappSession, "created_at" | "updated_at">
>;

export const find = async (
  params: FindOneParams,
): Promise<WhatsappSession | null> => {
  logger.info("[wa-session-find]");
  return await pg(TABLES.WHATSAPP_SESSIONS)
    .where(params)
    .orderBy("created_at", "desc")
    .first();
};

export const findManyBySessionIds = async (
  sessionIds: string[],
  params: FindManyParams,
): Promise<WhatsappSession[]> => {
  logger.info("[wa-session-findManyBySessionIds]");
  return await pg(TABLES.WHATSAPP_SESSIONS)
    .whereIn("id", sessionIds)
    .andWhere(params)
    .orderBy("created_at", "desc")
    .returning("*");
};

export const services = {
  create,
  update,
  find,
  findMany,
  findManyBySessionIds,
};
