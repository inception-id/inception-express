import { TABLES } from "../db/tables";
import { pg } from "../db/pg";
import { logger } from "../lib/logger";

export type User = {
  id: string;
  supertokens_user_id?: string;
  created_at: string;
  updated_at: string;
  email: string;
  phone?: string;
};

export const findUserById = async (userId: string): Promise<User | null> => {
  logger.info("findUserById", `Received request to find user by id: ${userId}`);
  try {
    return await pg(TABLES.USERS).where({ id: userId }).first();
  } catch (error) {
    logger.error("findUserById", error);
    return null;
  }
};
