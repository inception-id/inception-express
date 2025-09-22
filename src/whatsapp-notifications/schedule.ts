import { ENV } from "../env";
import { logger } from "../lib/logger";
import { services } from "./services";
import { WhatsappStatus } from "../lib/types";
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
    }

    // Send max 30 messages per hour
    logger.info(`[wa-notif-scheduleSend] ${notifCount} pending notifications`);
    if (notifCount > 30) {
      pendingNotifications = pendingNotifications.slice(0, 5);
    }

    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < pendingNotifications.length; i++) {
      const notification = pendingNotifications[i];
      const sentNotification = await whatsapp.services.sendMessage(
        String(ENV.INCEPTION_WHATSAPP_SESSION_ID),
        notification.target_phone,
        notification.text_message || "",
        notification.country_code,
      );

      await services.update(
        {
          id: notification.id,
        },
        {
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
