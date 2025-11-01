import { pg } from "../db/pg";
import { TABLES } from "../db/tables";
import { logger } from "../lib/logger";
import { services, WhatsappPayment, WhatsappPaymentStatus } from "./services";
import { CronJob } from "cron";

type WhatsappAggregate = {
  user_id: string;
  email: string;
  notification_count: string;
  message_count: string;
};

const aggregateLastMonthWhatsapp = async (): Promise<WhatsappAggregate[]> => {
  // Subquery: count notifications per user
  const notificationsSubquery = pg
    .queryBuilder()
    .from(TABLES.WHATSAPP_NOTIFICATIONS)
    .select("user_id")
    .count("* as notification_count")
    .where("status", "DELIVERED")
    .andWhere("environment", "PRODUCTION")
    .andWhereBetween("created_at", [
      pg.raw("date_trunc('month', CURRENT_DATE - interval '1 month')"),
      pg.raw("date_trunc('month', CURRENT_DATE)"),
    ])
    .groupBy("user_id")
    .as("n");

  // Subquery: count messages per user
  const messagesSubquery = pg
    .queryBuilder()
    .from(`${TABLES.WHATSAPP_SESSIONS} as s`)
    .join(`${TABLES.WHATSAPP_MESSAGES} as m`, "m.session_id", "s.id")
    .select("s.user_id")
    .count("m.id as message_count")
    .where("m.status", "DELIVERED")
    .andWhere("m.environment", "PRODUCTION")
    .andWhereBetween("m.created_at", [
      pg.raw("date_trunc('month', CURRENT_DATE - interval '1 month')"),
      pg.raw("date_trunc('month', CURRENT_DATE)"),
    ])
    .groupBy("s.user_id")
    .as("m");

  // Main query: combine users + subqueries
  const whatsappAggregate = await pg(`${TABLES.USERS} as u`)
    .select(
      "u.id as user_id",
      "u.email",
      pg.raw("COALESCE(n.notification_count, 0) as notification_count"),
      pg.raw("COALESCE(m.message_count, 0) as message_count"),
    )
    .leftJoin(notificationsSubquery, "n.user_id", "u.id")
    .leftJoin(messagesSubquery, "m.user_id", "u.id")
    .orderBy("notification_count", "desc");
  return whatsappAggregate;
};

const populateUserPayment = async (aggregate: WhatsappAggregate) => {
  const totalWhatsapp =
    Number(aggregate.message_count) + Number(aggregate.notification_count);
  const totalPayments =
    totalWhatsapp * services.countPricePerWhatsapp(totalWhatsapp);

  // Since always run on day 1 of the month
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const items = [
    { label: "notifications", value: Number(aggregate.notification_count) },
    { label: "messages", value: Number(aggregate.message_count) },
  ];
  const paymentParams: Omit<
    WhatsappPayment,
    "id" | "created_at" | "updated_at"
  > = {
    user_id: aggregate.user_id,
    amount: totalPayments,
    payment_status: WhatsappPaymentStatus.PENDING,
    items: JSON.stringify(items),
    paid_at: null,
    doku_request: null,
    doku_response: null,
    year: yesterday.getFullYear(),
    month: yesterday.getMonth(),
    doku_notif: null,
    per_unit_price: services.countPricePerWhatsapp(totalWhatsapp),
  };

  const payment = await services.create(paymentParams);
  return payment;
};

const populate = async () => {
  logger.info(
    `[wa-payment-schedulePopulate] Starting @ ${new Date().toLocaleString()}`,
  );
  const aggregates = await aggregateLastMonthWhatsapp();
  const paymentPromises = await Promise.allSettled(
    aggregates.map(populateUserPayment),
  );
  const success = paymentPromises.filter((p) => p.status === "fulfilled");
  const fail = paymentPromises.filter((p) => p.status === "rejected");

  logger.info(
    `[wa-payment-schedulePopulate] ${success.length} success, ${fail.length} failed`,
  );
};

const cron = () => {
  // Run  every 1st day of month
  const cronTime = "* * * 1 * *";
  logger.info(`[wa-payment-cron] ${cronTime}`);
  const job = new CronJob(
    cronTime, // cronTime
    populate, // onTick
  );
  job.start();
};

export const schedule = {
  cron,
};
