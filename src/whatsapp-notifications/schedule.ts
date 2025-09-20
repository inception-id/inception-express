import { ENV } from "../env";
import { logger } from "../lib/logger";
import { sendWhatsapp } from "../whatsapp/services";
import {
  findManyWaNotifications,
  updateWaNotifications,
  WhatsappStatus,
} from "./services";

export const scheduleWaNotif = async () => {
  logger.info(`[scheduleWaNotif] Starting @ ${new Date().toLocaleString()}`);
  try {
    let pendingNotifications = await findManyWaNotifications({
      status: WhatsappStatus.Pending,
    });

    const notifCount = pendingNotifications.length;
    if (notifCount === 0) {
      logger.info("[scheduleWaNotif] No pending notifications");
      return;
    }

    // Send max 30 messages per hour
    logger.info(`[scheduleWaNotif] ${notifCount} pending notifications`);
    if (notifCount > 30) {
      pendingNotifications = pendingNotifications.slice(0, 5);
    }

    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < pendingNotifications.length; i++) {
      const notification = pendingNotifications[i];
      const sentNotification = await sendWhatsapp(
        String(ENV.INCEPTION_WHATSAPP_SESSION_ID),
        notification.target_phone,
        notification.text_message || "",
        notification.country_code,
      );

      await updateWaNotifications(
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

    logger.info(`[scheduleWaNotif] ${successCount} sent, ${failCount} failed`);
  } catch (err) {
    logger.error("[scheduleWaNotif]", err);
  }
};
