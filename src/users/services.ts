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

type FindParams = Partial<
  Pick<User, "id" | "supertokens_user_id" | "email" | "phone">
>;
const find = async (params: FindParams): Promise<User | null> => {
  logger.info("[user-find]");
  try {
    return await pg(TABLES.USERS).where(params).first();
  } catch (error) {
    logger.error("[user-find]", error);
    return null;
  }
};

export const services = {
  find,
};
