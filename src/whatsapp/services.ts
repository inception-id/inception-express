import WAWebJS, { Client, ClientOptions, LocalAuth } from "whatsapp-web.js";
import qrCodeTerminal from "qrcode-terminal";
import { logger } from "../lib/logger";
import fs from "fs";
import whatsappSessions from "../whatsapp-sessions";

export const whatsappQrStore = new Map<string, string>();
export const whatsappClientStore = new Map<string, Client>();

const createClientOptions = (sessionId: string): ClientOptions => {
  return {
    qrMaxRetries: 1,
    puppeteer: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
    authStrategy: new LocalAuth({
      clientId: sessionId,
    }),
  };
};

const destroyClient = async (client: WAWebJS.Client, sessionId: string) => {
  await client.destroy();
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

export const initWhatsappClient = async (
  sessionId: string,
): Promise<Client | null> => {
  logger.info(`[initWhatsappClient]: ${sessionId}`);
  const client = new Client(createClientOptions(sessionId));

  const isInitialized = await new Promise<boolean>((resolve, reject) => {
    client.on("auth_failure", async (message) => {
      logger.error(`[initWhatsappClient] auth_failure: ${message}`);
      const destroyed = await destroyClient(client, sessionId);
      reject(destroyed);
    });

    client.on("authenticated", () => {
      logger.info(`[initWhatsappClient] authenticated: ${sessionId}`);
    });

    client.on("disconnected", async (reason) => {
      logger.error(`[initWhatsappClient] disconnected: ${reason}`);
      const destroyed = await destroyClient(client, sessionId);
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

export const destroyWhatsappClient = async (
  sessionId: string,
): Promise<boolean> => {
  logger.info(`[destroyWhatsappClient] ${sessionId}`);
  await whatsappSessions.services.update(
    { id: sessionId },
    { is_deleted: true },
  );
  let clientStore = whatsappClientStore.get(sessionId);
  if (!clientStore) {
    const client = await initWhatsappClient(sessionId);
    if (client) return await destroyClient(client, sessionId);
    return false;
  } else {
    return await destroyClient(clientStore, sessionId);
  }
};

export const sendWhatsapp = async (
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
      const client = await initWhatsappClient(sessionId);

      if (client) {
        return await client.sendMessage(chatId, message);
      }
      return null;
    } else {
      return await clientStore.sendMessage(chatId, message);
    }
  } catch (err) {
    logger.error("[sendWhatsapp]", err);
    return null;
  }
};
