import { ENV } from "../env";
import { logger } from "../lib/logger";
import { services, WhatsappNotification } from "./services";
import { WhatsappEnvironment, WhatsappStatus } from "../lib/types";
import whatsapp from "../whatsapp";

const sendAndUpdateNotifications = async (
  notification: WhatsappNotification,
): Promise<WhatsappNotification[]> => {
  const sendMessageParam = {
    sessionId: String(ENV.INCEPTION_WHATSAPP_SESSION_ID),
    phoneNumber: notification.target_phone,
    message: notification.text_message || "",
    countryCode: notification.country_code,
    mediaUrl: notification.media_url,
  };
  const sentNotification =
    await whatsapp.services.sendMessage(sendMessageParam);

  const totalCount = await whatsapp.services.countCurrentMonthWhatsapp(
    notification.user_id,
  );
  const environment =
    Number(totalCount) > ENV.DEVELOPMENT_MONTHLY_LIMIT
      ? WhatsappEnvironment.Production
      : WhatsappEnvironment.Development;
  return await services.update(
    {
      id: notification.id,
    },
    {
      environment,
      status: sentNotification?.id
        ? WhatsappStatus.Delivered
        : WhatsappStatus.Failed,
    },
  );
};

const send = async () => {
  logger.info(
    `[wa-notif-scheduleSend] Starting @ ${new Date().toLocaleString()}`,
  );
  try {
    let pendingNotifications = await services.findMany({
      status: WhatsappStatus.Pending,
    });

    const notifCount = pendingNotifications.length;
    if (notifCount === 0) {
      logger.info("[wa-notif-scheduleSend] No pending notifications");
      return;
    }

    logger.info(`[wa-notif-scheduleSend] ${notifCount} pending notifications`);

    // Send max 10 messages per 10 mins
    const maxNotifCount = Math.floor(Math.random() * 10);
    if (notifCount > maxNotifCount) {
      pendingNotifications = pendingNotifications.slice(0, maxNotifCount);
    }

    const settledNotifications = await Promise.allSettled(
      pendingNotifications.map(
        async (notif) => await sendAndUpdateNotifications(notif),
      ),
    );

    const successCount = settledNotifications.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const failCount = settledNotifications.filter(
      (result) =>
        result.status === "rejected" ||
        result.value[0].status === WhatsappStatus.Failed,
    ).length;

    logger.info(
      `[wa-notif-scheduleSend] ${successCount} sent, ${failCount} failed`,
    );
  } catch (err) {
    logger.error("[wa-notif-scheduleSend]", err);
  }
};

export const schedule = {
  send,
};
