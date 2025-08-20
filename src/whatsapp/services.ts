import WAWebJS, { Client, ClientOptions, LocalAuth } from "whatsapp-web.js";
import qrCodeTerminal from "qrcode-terminal";
import {
  createWhatsappSession,
  updateWhatsappSession,
} from "../whatsapp-sessions/services";
import { logger } from "../lib/logger";
import fs from "fs";

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

export const initWhatsappClient = async (
  sessionId: string,
): Promise<Client> => {
  logger.info(`Initializing WhatsApp client ${sessionId}`);
  const client = new Client(createClientOptions(sessionId));

  // When the client received QR-Code
  client.on("qr", (qr) => {
    whatsappQrStore.set(sessionId, qr); // store QR code
    logger.info(`QR code received for session ${sessionId}`);
  });

  // When the client is ready, run this code (only once)
  client.once("ready", () => {
    whatsappClientStore.set(sessionId, client);
    updateWhatsappSession(sessionId, { is_ready: true });
    logger.info(`WhatsApp client ${sessionId} is ready`);
  });

  client.on("disconnected", async (reason) => {
    logger.info(`Client ${sessionId} was logged out`, reason); // Client was logged out Max qrcode retries reached
    client.destroy();
  });

  await client.initialize();

  return client;
};

export const destroyWhatsappClient = async (
  sessionId: string,
): Promise<boolean> => {
  logger.info(`Destroying WhatsApp client ${sessionId}`);
  let clientStore = whatsappClientStore.get(sessionId);
  if (!clientStore) {
    logger.info(`No client store for ${sessionId}, reinitializing...`);
    const client = new Client(createClientOptions(sessionId));
    await client.initialize();

    client.once("ready", async () => {
      client.destroy();
      fs.rmSync(`.wwebjs_auth/session-${sessionId}`, {
        recursive: true,
        force: true,
      });
    });
  } else {
    clientStore.destroy();
    fs.rmSync(`.wwebjs_auth/session-${sessionId}`, {
      recursive: true,
      force: true,
    });
  }
  return true;
};

export const sendWhatsapp = async (
  sessionId: string,
  phoneNumber: string,
  message: string,
): Promise<{ sessionId: string; phoneNumber: string; message: string }> => {
  logger.info(`Sending WhatsApp message to ${phoneNumber}`);
  const chatId = `62` + phoneNumber + "@c.us";

  let clientStore = whatsappClientStore.get(sessionId);
  if (!clientStore) {
    logger.info(`No client store for ${sessionId}, reinitializing...`);
    const client = new Client(createClientOptions(sessionId));

    await client.initialize();

    // When the client is ready, run this code (only once)
    client.once("ready", async () => {
      whatsappClientStore.set(sessionId, client);
      const msg = await client.sendMessage(chatId, message);
    });

    return { sessionId, phoneNumber, message };
  } else {
    await clientStore.sendMessage(chatId, message);
    return { sessionId, phoneNumber, message };
  }
};
