import crypto from "crypto";
import { ENV } from "../env";
import { logger } from "../lib/logger";

const generateSignature = (
  requestID: string,
  requestTimestamp: string,
  jsonBody: Record<string, any>,
) => {
  const digestSHA256 = crypto
    .createHash("sha256")
    .update(JSON.stringify(jsonBody))
    .digest();
  const digestBase64 = digestSHA256.toString("base64");
  const signatureComponents = [
    `Client-Id:${ENV.DOKU_CLIENT_ID}`,
    `Request-Id:${requestID}`,
    `Request-Timestamp:${requestTimestamp}`,
    `Request-Target:/checkout/v1/payment`,
    `Digest:${digestBase64}`,
  ].join("\n");
  const signatureHmacSha256 = crypto
    .createHmac("sha256", String(ENV.DOKU_SECRET_KEY))
    .update(signatureComponents)
    .digest("base64");

  return `HMACSHA256=${signatureHmacSha256}`;
};

const initiatePayment = async (email: string, amount: number) => {
  try {
    const url = String(ENV.DOKU_API_URL) + "/checkout/v1/payment";
    const requestID = crypto.randomUUID();
    const requestTimestamp = new Date().toISOString().slice(0, 19) + "Z";
    const currentTimestamp = Math.floor(new Date().getTime() / 1000);
    const jsonBody = {
      order: {
        amount,
        invoice_number: `INV-${currentTimestamp}`,
        currency: "IDR",
        callback_url: ENV.DOKU_CALLBACK_URL,
      },
      payment: {
        payment_due_date: 60,
      },
      customer: {
        email,
      },
    };

    const signature = generateSignature(requestID, requestTimestamp, jsonBody);
    const dokuHeaders = {
      "Client-Id": String(ENV.DOKU_CLIENT_ID),
      "Request-Id": requestID,
      "Request-Timestamp": requestTimestamp,
      Signature: signature,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...dokuHeaders,
      },
      body: JSON.stringify(jsonBody),
    });

    const dokuResponse = await res.json();
    return { dokuRequest: jsonBody, dokuResponse };
  } catch (error) {
    logger.error("[doku-initiatePayment]", error);
    throw error;
  }
};

export const doku = { initiatePayment };
