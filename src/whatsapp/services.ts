import WAWebJS, { Client, ClientOptions, LocalAuth } from "whatsapp-web.js";
import qrCodeTerminal from "qrcode-terminal";
import {
  createWhatsappSession,
  updateWhatsappSession,
} from "../whatsapp-sessions/services";
import { logger } from "../lib/logger";
import fs from "fs";
import { count } from "console";

export const whatsappQrStore = new Map<string, string>();
export const whatsappClientStore = new Map<string, Client>();

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

const destroyClient = async (client: WAWebJS.Client, sessionId: string) => {
  await client.destroy();
  fs.rmSync(`.wwebjs_auth/session-${sessionId}`, {
    recursive: true,
    force: true,
  });
  fs.rmSync(`/app/.wwebjs_auth/session-${sessionId}`, {
    recursive: true,
    force: true,
  });
  return whatsappClientStore.delete(sessionId);
};

export const initWhatsappClient = async (
  sessionId: string,
): Promise<Client> => {
  logger.info(`initWhatsappClient: ${sessionId}`);
  const client = new Client(createClientOptions(sessionId));

  await new Promise<void>((resolve, reject) => {
    client.on("auth_failure", async (message) => {
      await destroyClient(client, sessionId);
      const msg = "Error trying to restore an existing session:" + message;
      reject(new Error(msg));
    });

    client.on("authenticated", () => {
      logger.info(`Authentication successful: ${sessionId}`);
    });

    client.on("disconnected", async (reason) => {
      await destroyClient(client, sessionId);
      const msg = `Client ${sessionId} has been disconnected: ${reason}`;
      reject(new Error(msg));
    });

    client.on("qr", (qr) => {
      logger.info("QR code received", sessionId);
      whatsappQrStore.set(sessionId, qr); // store QR code
      resolve();
    });

    client.once("ready", () => {
      logger.info(`Client is ready:`, sessionId);
      whatsappQrStore.delete(sessionId);
      whatsappClientStore.set(sessionId, client);
      updateWhatsappSession(sessionId, { is_ready: true });
    });
    client.initialize();
  });

  // call initialize after listeners are attached (initialize returns void)
  return client;
};

export const destroyWhatsappClient = async (
  sessionId: string,
): Promise<boolean> => {
  logger.info(`Destroying WhatsApp client ${sessionId}`);
  await updateWhatsappSession(sessionId, { is_deleted: true });

  let clientStore = whatsappClientStore.get(sessionId);
  if (!clientStore) {
    logger.info(`Restoring session: ${sessionId}`);
    const client = new Client(createClientOptions(sessionId));

    await new Promise<void>((resolve) => {
      client.on("auth_failure", async (message) => {
        const msg = "Error trying to restore an existing session:" + message;
        logger.info(msg);
        resolve();
      });

      client.on("authenticated", () => {
        logger.info(`Authentication successful: ${sessionId}`);
        resolve();
      });

      client.on("disconnected", async (reason) => {
        const msg = `Client ${sessionId} has been disconnected: ${reason}`;
        logger.info(msg);
        resolve();
      });

      client.once("ready", () => {
        logger.info(`Client is ready:`, sessionId);
        resolve();
      });
      client.initialize();
    });
    return await destroyClient(client, sessionId);
  } else {
    return await destroyClient(clientStore, sessionId);
  }
};

export const sendWhatsapp = async (
  sessionId: string,
  phoneNumber: string,
  message: string,
  countryCode?: string,
): Promise<{ sessionId: string; phoneNumber: string; message: string }> => {
  logger.info("sendWhatsapp");
  const prefixCode = countryCode ? countryCode : "62";
  const chatId = prefixCode + phoneNumber + "@c.us";

  let clientStore = whatsappClientStore.get(sessionId);
  if (!clientStore) {
    logger.info(`initWhatsappClient: ${sessionId}`);
    const client = new Client(createClientOptions(sessionId));

    await new Promise<void>((resolve, reject) => {
      client.on("auth_failure", async (message) => {
        await destroyClient(client, sessionId);
        const msg = "Error trying to restore an existing session:" + message;
        reject(new Error(msg));
      });

      client.on("authenticated", () => {
        logger.info(`Authentication successful: ${sessionId}`);
      });

      client.on("disconnected", async (reason) => {
        await destroyClient(client, sessionId);
        const msg = `Client ${sessionId} has been disconnected: ${reason}`;
        reject(new Error(msg));
      });

      client.once("ready", () => {
        logger.info(`Client is ready:`, sessionId);
        whatsappClientStore.set(sessionId, client);
        resolve();
      });
      client.initialize();
    });

    await client.sendMessage(chatId, message);
    return { sessionId, phoneNumber, message };
  } else {
    await clientStore.sendMessage(chatId, message);
    return { sessionId, phoneNumber, message };
  }
};
