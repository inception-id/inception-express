import { pg } from "../db/pg";
import { TABLES } from "../db/tables";
import { logger } from "../lib/logger";

export type ApiKey = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  api_key: string;
};

type FindParams = Partial<Pick<ApiKey, "id" | "user_id">>;

const find = async (params: FindParams): Promise<ApiKey | null> => {
  logger.info("[api-key-find]");
  try {
    return await pg(TABLES.API_KEYS)
      .where(params)
      .orderBy("created_at", "desc")
      .first();
  } catch (err) {
    logger.error("[api-key-find]", err);
    return null;
  }
};

export const services = {
  find,
};
