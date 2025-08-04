import { TABLES } from "../db/tables";
import { pg } from "../db/pg";

export type User = {
  id: string;
  supertokens_user_id?: string;
  created_at: string;
  updated_at: string;
  email: string;
  phone?: string;
};

export const findUserById = async (userId: string): Promise<User | null> => {
  try {
    return await pg(TABLES.USERS).where({ id: userId }).first();
  } catch (error) {
    console.error("findUserById", error);
    return null;
  }
};
