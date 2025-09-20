import { logger } from "../lib/logger";
import { findManyWaNotifications, WhatsappStatus } from "./services";

export const scheduleWaNotif = async () => {
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
      pendingNotifications = pendingNotifications.slice(0, 30);
    }
  } catch (err) {
    logger.error("[scheduleWaNotif]", err);
  }
};
