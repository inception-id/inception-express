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
      fs.rmSync(`/app/.wwebjs_auth/session-${sessionId}`, {
        recursive: true,
        force: true,
      });
    });
  } else {
    clientStore.destroy();
    fs.rmSync(`/app/.wwebjs_auth/session-${sessionId}`, {
      recursive: true,
      force: true,
    });
    whatsappClientStore.delete(sessionId);
  }
  return true;
};

export const sendWhatsapp = async (
  sessionId: string,
  phoneNumber: string,
  message: string,
  countryCode?: string,
): Promise<{ sessionId: string; phoneNumber: string; message: string }> => {
  logger.info(`Sending WhatsApp message to ${phoneNumber}`);
  const prefixCode = countryCode ? countryCode : "62";
  const chatId = prefixCode + phoneNumber + "@c.us";

  let clientStore = whatsappClientStore.get(sessionId);
  if (!clientStore) {
    logger.info(`No client store for ${sessionId}, reinitializing...`);
    const client = new Client(createClientOptions(sessionId));
    // client.once("ready", async () => {
    //   whatsappClientStore.set(sessionId, clientStore);
    //   const msg = await clientStore.sendMessage(chatId, message);
    // });
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        client.removeListener("ready", onReady);
        client.removeListener("auth_failure", onAuthFailure);
        client.removeListener("disconnected", onDisconnected);
        client.removeListener("error", onError);
      };

      const onReady = () => {
        cleanup();
        resolve();
        logger.info(`Client ${sessionId} is ready`);
      };

      const onAuthFailure = (msg?: any) => {
        cleanup();
        reject(new Error("Client auth failure: " + (msg ?? "unknown")));
      };

      const onDisconnected = (reason?: any) => {
        cleanup();
        reject(
          new Error(
            "Client disconnected before ready: " + (reason ?? "unknown"),
          ),
        );
      };

      const onError = (err: any) => {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      client.once("ready", onReady);
      client.once("auth_failure", onAuthFailure);
      client.once("disconnected", onDisconnected);
      client.once("error", onError);

      // call initialize after listeners are attached (initialize returns void)
      client.initialize();
    });

    // When the client is ready, run this code (only once)
    whatsappClientStore.set(sessionId, client);
    const msg = await client.sendMessage(chatId, message);
    console.log("Message with reinit: ", msg);
    return { sessionId, phoneNumber, message };
  } else {
    const msg = await clientStore.sendMessage(chatId, message);
    console.log("Message without reinit: ", msg);
    return { sessionId, phoneNumber, message };
  }
};
