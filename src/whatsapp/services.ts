import WAWebJS, { Client, ClientOptions, LocalAuth } from "whatsapp-web.js";
import { logger } from "../lib/logger";
import fs from "fs";
import whatsappSessions from "../whatsapp-sessions";

const whatsappQrStore = new Map<string, string>();
const getClientQr = (sessionId: string): string | undefined => {
  return whatsappQrStore.get(sessionId);
};

const createClientOptions = (sessionId: string): ClientOptions => {
  return {
    qrMaxRetries: 1,
    puppeteer: {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        `--user-data-dir=/tmp/chrome-${Date.now()}`,
      ],
    },
    authStrategy: new LocalAuth({
      clientId: sessionId,
    }),
  };
};

const whatsappClientStore = new Map<string, Client>();
const destroyLocalClient = async (sessionId: string) => {
  logger.info(`[wa-destroyLocalClient]: ${sessionId}`);
  // localhost
  fs.rmSync(`.wwebjs_auth/session-${sessionId}`, {
    recursive: true,
    force: true,
  });
  // docker
  fs.rmSync(`/app/.wwebjs_auth/session-${sessionId}`, {
    recursive: true,
    force: true,
  });
  return whatsappClientStore.delete(sessionId);
};

const initClient = async (sessionId: string): Promise<Client | null> => {
  logger.info(`[initClient]: ${sessionId}`);
  const client = new Client(createClientOptions(sessionId));

  const isInitialized = await new Promise<boolean>((resolve, reject) => {
    client.on("auth_failure", async (message) => {
      logger.error(`[initWhatsappClient] auth_failure: ${message}`);
      const destroyed = await destroyLocalClient(sessionId);
      reject(destroyed);
    });

    client.on("authenticated", () => {
      logger.info(`[initWhatsappClient] authenticated: ${sessionId}`);
    });

    client.on("disconnected", async (reason) => {
      logger.error(`[initWhatsappClient] disconnected: ${reason}`);
      const destroyed = await destroyLocalClient(sessionId);
      reject(destroyed);
    });

    client.on("qr", (qr) => {
      logger.info(`[initWhatsappClient] qr received: ${sessionId}`);
      whatsappQrStore.set(sessionId, qr); // store QR code
      resolve(true);
    });

    client.once("ready", () => {
      logger.info(`Client is ready:`, sessionId);
      whatsappQrStore.delete(sessionId);
      whatsappClientStore.set(sessionId, client);
      whatsappSessions.services.update({ id: sessionId }, { is_ready: true });
      resolve(true);
    });
    client.initialize();
  });

  if (isInitialized) {
    return client;
  }

  return null;
};

const destroyClient = async (sessionId: string): Promise<boolean> => {
  logger.info(`[destroyWhatsappClient] ${sessionId}`);
  await whatsappSessions.services.update(
    { id: sessionId },
    { is_deleted: true },
  );
  let clientStore = whatsappClientStore.get(sessionId);
  if (!clientStore) {
    const client = await initClient(sessionId);
    if (client) await client.destroy();
  } else {
    await clientStore.destroy();
  }
  return await destroyLocalClient(sessionId);
};

const sendMessage = async (
  sessionId: string,
  phoneNumber: string,
  message: string,
  countryCode?: string,
): Promise<WAWebJS.Message | null> => {
  logger.info("[sendWhatsapp]");
  try {
    const prefixCode = countryCode ? countryCode : "62";
    const chatId = prefixCode + phoneNumber + "@c.us";
    const clientStore = whatsappClientStore.get(sessionId);

    if (!clientStore) {
      const client = await initClient(sessionId);
      if (client) {
        return await client.sendMessage(chatId, message);
      }
    } else {
      return await clientStore.sendMessage(chatId, message);
    }
    return null;
  } catch (err) {
    logger.error("[sendWhatsapp]", err);
    return null;
  }
};

export const services = {
  getClientQr,
  destroyClient,
  initClient,
  sendMessage,
};
