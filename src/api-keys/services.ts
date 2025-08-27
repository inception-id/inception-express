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

export const findApiKey = async (id: string): Promise<ApiKey[]> => {
  try {
    return await pg(TABLES.API_KEYS)
      .where({ id })
      .orderBy("created_at", "desc")
      .returning("*");
  } catch (err) {
    logger.error("findApiKey:", err);
    throw err;
  }
};
