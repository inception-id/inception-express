import { ENV } from "../env";
import { logger } from "../lib/logger";
import { services } from "./services";
import { WhatsappEnvironment, WhatsappStatus } from "../lib/types";
import whatsapp from "../whatsapp";

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
    } else {
      logger.info(
        `[wa-notif-scheduleSend] ${notifCount} pending notifications`,
      );
    }

    // Send max 10 messages per 10 mins
    const maxNotifCount = Math.floor(Math.random() * 10);
    if (notifCount > maxNotifCount) {
      pendingNotifications = pendingNotifications.slice(0, maxNotifCount);
    }

    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < pendingNotifications.length; i++) {
      const notification = pendingNotifications[i];

      const sendMessageParam = {
        sessionId: String(ENV.INCEPTION_WHATSAPP_SESSION_ID),
        phoneNumber: notification.target_phone,
        message: notification.text_message || "",
        countryCode: notification.country_code,
      };
      const sentNotification =
        await whatsapp.services.sendMessage(sendMessageParam);

      const notifCount = await services.countCurrentMonth(notification.user_id);
      const environment =
        Number(notifCount.count) > ENV.DEVELOPMENT_MONTHLY_LIMIT
          ? WhatsappEnvironment.Production
          : WhatsappEnvironment.Development;
      await services.update(
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

      if (sentNotification?.id) {
        successCount++;
      } else {
        failCount++;
      }
    }

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
