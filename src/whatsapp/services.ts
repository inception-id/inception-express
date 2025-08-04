import { Client, LocalAuth } from "whatsapp-web.js";
import qrCodeTerminal from "qrcode-terminal";

export const whatsappQrStore = new Map<string, string>();
export const whatsappClientStore = new Map<string, Client>();

export const initWhatsappClient = async (
  sessionId: string,
): Promise<Client> => {
  const client = new Client({
    puppeteer: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
    authStrategy: new LocalAuth({
      clientId: sessionId,
    }),
  });

  // When the client is ready, run this code (only once)
  client.once("ready", () => {
    whatsappClientStore.set(sessionId, client);
    console.log(`Client ${sessionId} is ready!`);
  });

  // When the client received QR-Code
  client.on("qr", (qr) => {
    console.log(`QR RECEIVED for ${sessionId}`, qr);
    whatsappQrStore.set(sessionId, qr); // store QR code
    qrCodeTerminal.generate(qr, { small: true });
  });

  await client.initialize();

  return client;
};

export const sendWhatsapp = async (
  clientId: string,
  client: Client,
): Promise<Client> => {
  // client.on("authenticated", async () => {
  // });

  try {
    console.log(`Message Client ${clientId} is ready!`);

    let number = "";
    // Number where you want to send the message.

    // Your message.
    const text = "Kirim whatsapp lagi";

    // Getting chatId from the number.
    // we have to delete "+" from the beginning and add "@c.us" at the end of the number.
    const chatId = number + "@c.us";

    // Sending message.
    const msg = await client.sendMessage(chatId, text);
    console.log("Success sending message from ", msg.from);
  } catch (error) {
    console.error(`Error sending message from ${clientId}:`, error);
  }
  return client;
};
