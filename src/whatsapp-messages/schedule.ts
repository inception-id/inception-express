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

const sendAndUpdateMessage = async (message: WhatsappMessage) => {
  const msg = await whatsapp.services.sendMessage(
    message.session_id,
    message.target_phone,
    String(message.text_message),
    message.country_code,
  );

  const environment = await defineEnvironment(message.session_id);
  await services.update(
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
      logger.info("[wa-message-scheduleSend] No pending notifications");
      return;
    }

    logger.info(
      `[wa-message-scheduleSend] ${pendingMessages.length} pending notifications`,
    );

    if (pendingMessages.length < 10) {
      for (let j = 0; j < pendingMessages.length; j++) {
        await sendAndUpdateMessage(pendingMessages[j]);
      }
      return;
    }

    // Generate random timeout seconds from 1 to 9
    // Since one hour is 60 mins, we set 6 different timeouts, each between 1 and 9 mins
    const firstTimeOut = Math.floor(Math.random() * 10);
    const secondTimeOut = firstTimeOut + Math.floor(Math.random() * 10) + 1;
    const thirdTimeOut = secondTimeOut + Math.floor(Math.random() * 10) + 1;
    const fourthTimeOut = thirdTimeOut + Math.floor(Math.random() * 10) + 1;
    const fifthTimeOut = fourthTimeOut + Math.floor(Math.random() * 10) + 1;
    const sixthTimeOut = fifthTimeOut + Math.floor(Math.random() * 10) + 1;
    const timeouts = [
      firstTimeOut,
      secondTimeOut,
      thirdTimeOut,
      fourthTimeOut,
      fifthTimeOut,
      sixthTimeOut,
    ];

    for (let i = 0; i < timeouts.length; i++) {
      if (pendingMessages.length > timeouts[i]) {
        const firstSlice = i === 0 ? 0 : timeouts[i - 1];
        setTimeout(async () => {
          const msgSlice = pendingMessages.slice(firstSlice, timeouts[i]);
          for (let j = 0; j < msgSlice.length; j++) {
            await sendAndUpdateMessage(msgSlice[j]);
          }
        }, timeouts[i] * 1000);
      }
    }
  } catch (err) {
    logger.error("[wa-message-scheduleSend]", err);
  }
};

export const schedule = {
  send,
};
