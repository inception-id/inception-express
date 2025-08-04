import knex from "knex";
import { ENV } from "../env";

export const pg = knex({
  client: "pg",
  connection: ENV.DATABASE_URL,
});
