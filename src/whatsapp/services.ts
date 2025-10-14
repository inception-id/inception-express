import WAWebJS, {
  Client,
  ClientOptions,
  LocalAuth,
  MessageMedia,
} from "whatsapp-web.js";
import { logger } from "../lib/logger";
import fs from "fs";
import whatsappSessions from "../whatsapp-sessions";

const whatsappQrStore = new Map<string, string>();
const whatsappClientStore = new Map<string, Client>();

const getClientQr = (sessionId: string): string | undefined => {
  return whatsappQrStore.get(sessionId);
};

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

const destroyLocalClient = async (sessionId: string) => {
  logger.info(`[wa-destroyLocalClient]: ${sessionId}`);
  // db
  const session = await whatsappSessions.services.update(
    { id: sessionId },
    { is_disconnected: true },
  );
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
  console.log(session);
  return whatsappClientStore.delete(sessionId);
};

const initClient = async (sessionId: string): Promise<Client | null> => {
  logger.info(`[initClient]: ${sessionId}`);
  const client = new Client(createClientOptions(sessionId));

  const isInitialized = await new Promise<boolean>((resolve, reject) => {
    client.on("auth_failure", async (message) => {
      logger.error(`[initClient] auth_failure: ${message}`);
      const destroyed = await destroyLocalClient(sessionId);
      reject(destroyed);
    });

    client.on("authenticated", () => {
      logger.info(`[initClient] authenticated: ${sessionId}`);
    });

    client.on("disconnected", async (reason) => {
      logger.error(`[initClient] disconnected: ${reason}`);
      const destroyed = await destroyLocalClient(sessionId);
      reject(destroyed);
    });

    client.on("qr", (qr) => {
      logger.info(`[initClient] qr received: ${sessionId}`);
      whatsappQrStore.set(sessionId, qr); // store QR code
      resolve(true);
    });

    client.once("ready", () => {
      logger.info(`[initClient] ready:`, sessionId);
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

const reconnectClient = async (sessionId: string): Promise<Client | null> => {
  logger.info(`[reconnectClient]: ${sessionId}`);
  const client = new Client(createClientOptions(sessionId));

  const isInitialized = await new Promise<boolean>((resolve, reject) => {
    client.on("auth_failure", async (message) => {
      logger.error(`[reconnectClient] auth_failure: ${message}`);
      const destroyed = await destroyLocalClient(sessionId);
      reject(destroyed);
    });

    client.on("authenticated", () => {
      logger.info(`[reconnectClient] authenticated: ${sessionId}`);
    });

    client.on("disconnected", async (reason) => {
      logger.error(`[reconnectClient] disconnected: ${reason}`);
      const destroyed = await destroyLocalClient(sessionId);
      reject(destroyed);
    });

    client.once("ready", () => {
      logger.info(`[reconnectClient]:`, sessionId);
      whatsappClientStore.set(sessionId, client);
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
    { is_deleted: true, is_disconnected: true },
  );
  let clientStore = whatsappClientStore.get(sessionId);
  if (!clientStore) {
    const client = await reconnectClient(sessionId);
    if (client) await client.destroy();
  } else {
    await clientStore.destroy();
  }
  return await destroyLocalClient(sessionId);
};

type SendMessageParam = {
  sessionId: string;
  phoneNumber: string;
  message: string;
  countryCode?: string;
  mediaUrl?: string | null;
};

const sendMessage = async ({
  sessionId,
  phoneNumber,
  message,
  countryCode,
  mediaUrl,
}: SendMessageParam): Promise<WAWebJS.Message | null> => {
  logger.info("[sendWhatsapp]");
  try {
    const prefixCode = countryCode ? countryCode : "62";
    const chatId = prefixCode + phoneNumber + "@c.us";
    const clientStore = whatsappClientStore.get(sessionId);

    if (!clientStore) {
      const client = await reconnectClient(sessionId);
      if (client) {
        if (mediaUrl) {
          const media = await MessageMedia.fromUrl(mediaUrl);
          return await client.sendMessage(chatId, media, { caption: message });
        }
        return await client.sendMessage(chatId, message);
      }
    } else {
      if (mediaUrl) {
        const media = await MessageMedia.fromUrl(mediaUrl);
        return await clientStore.sendMessage(chatId, media, {
          caption: message,
        });
      }
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
