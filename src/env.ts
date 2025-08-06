import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  DATABASE_URL: process.env.DATABASE_URL,
  ALLOW_ORIGIN: process.env.ALLOW_ORIGIN,
  API_KEY: process.env.API_KEY,
};
