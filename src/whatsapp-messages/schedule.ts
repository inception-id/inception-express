import { logger } from "../lib/logger";
import { services, WhatsappMessage } from "./services";
import { WhatsappEnvironment, WhatsappStatus } from "../lib/types";
import whatsapp from "../whatsapp";
import whatsappSessions from "../whatsapp-sessions";
import { ENV } from "../env";

const defineEnvironment = async (sessionId: string) => {
  const session = await whatsappSessions.services.find({
    id: sessionId,
  });
  const userSessions = await whatsappSessions.services.findMany({
    user_id: session?.user_id,
    is_ready: true,
  });
  const sessionIds = userSessions.map((session) => session.id);

  const messageCount = await services.countCurrentMonth(sessionIds);
  const environment =
    Number(messageCount.count) > ENV.DEVELOPMENT_MONTHLY_LIMIT
      ? WhatsappEnvironment.Production
      : WhatsappEnvironment.Development;
  return environment;
};

const sendAndUpdateMessage = async (
  message: WhatsappMessage,
): Promise<WhatsappMessage[]> => {
  const sendMessageParam = {
    sessionId: message.session_id,
    phoneNumber: message.target_phone,
    message: String(message.text_message),
    countryCode: message.country_code,
    media_url: message.media_url,
  };
  const msg = await whatsapp.services.sendMessage(sendMessageParam);

  const environment = await defineEnvironment(message.session_id);
  return await services.update(
    { id: message.id },
    {
      environment,
      status: msg?.id ? WhatsappStatus.Delivered : WhatsappStatus.Failed,
    },
  );
};

const send = async () => {
  logger.info(
    `[wa-messsage-scheduleSend] Starting @ ${new Date().toLocaleString()}`,
  );
  try {
    const pendingMessages = await services.findMany({
      status: WhatsappStatus.Pending,
    });

    if (pendingMessages.length === 0) {
      logger.info("[wa-message-scheduleSend] No pending messages");
      return;
    }

    logger.info(
      `[wa-message-scheduleSend] ${pendingMessages.length} pending messages`,
    );

    const groupedMessages = pendingMessages.reduce(
      (acc, item) => {
        if (!acc[item.session_id]) {
          acc[item.session_id] = [item];
        }
        acc[item.session_id].push(item);
        return acc;
      },
      {} as Record<string, WhatsappMessage[]>,
    );

    // Send max 10 messages per 10 mins
    const maxMessageCount = Math.floor(Math.random() * 10);
    const distinctSessionIds = Object.keys(groupedMessages);

    const settledMessages = await Promise.allSettled(
      distinctSessionIds.map(async (sessionId) => {
        let sessionMessages = groupedMessages[sessionId];
        if (sessionMessages.length > maxMessageCount) {
          sessionMessages = sessionMessages.slice(0, maxMessageCount);
        }

        let sentMessages = [];
        for (let i = 0; i < sessionMessages.length; i++) {
          const message = sessionMessages[i];
          const sentMessage = await sendAndUpdateMessage(message);
          sentMessages.push(sentMessage);
        }
        return sentMessages;
      }),
    );
    const successCount = settledMessages.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const failCount = settledMessages.filter(
      (result) => result.status === "rejected",
    ).length;

    logger.info(
      `[wa-notif-scheduleSend] ${successCount} sent, ${failCount} failed`,
    );
  } catch (err) {
    logger.error("[wa-message-scheduleSend]", err);
  }
};

const updateDisconnected = async () => {
  logger.info(
    `[wa-messsage-updatedDisconnected] Starting @ ${new Date().toLocaleString()}`,
  );
  try {
    const disconnectedSessions = await whatsappSessions.services.findMany({
      is_disconnected: true,
    });

    const sessionIds = disconnectedSessions.map((session) => session.id);

    const pendingMessages = await services.findManyBySessionIds(sessionIds, {
      status: WhatsappStatus.Pending,
    });

    if (pendingMessages.length === 0) {
      logger.info("[wa-message-updateDisconnected] No disconnected messages");
      return;
    }

    logger.info(
      `[wa-message-updateDisconnected] ${pendingMessages.length} pending messages`,
    );

    const settledMessages = await Promise.allSettled(
      pendingMessages.map(
        async (msg) =>
          await services.update(
            { id: msg.id },
            { status: WhatsappStatus.Disconnected },
          ),
      ),
    );

    logger.info(
      `[wa-notif-updateDisconnected] ${settledMessages.length} disconnected messages`,
    );
  } catch (err) {
    logger.error("[wa-message-updateDisconnected]", err);
  }
};

export const schedule = {
  send,
  updateDisconnected,
};
