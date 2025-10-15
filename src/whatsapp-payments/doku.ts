import crypto from "crypto";
import { ENV } from "../env";
import { logger } from "../lib/logger";
import { TABLES } from "../db/tables";
import { pg } from "../db/pg";
import { WhatsappPayment } from "./services";

type GenerateSignatureParams = {
  requestID: string;
  requestTimestamp: string;
  clientId: string;
  requestTarget: string;
  jsonBody: Record<string, any>;
};

export const generateSignature = ({
  requestID,
  requestTimestamp,
  clientId,
  requestTarget,
  jsonBody,
}: GenerateSignatureParams) => {
  const digestSHA256 = crypto
    .createHash("sha256")
    .update(JSON.stringify(jsonBody))
    .digest();
  const digestBase64 = digestSHA256.toString("base64");
  const signatureComponents = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestID}`,
    `Request-Timestamp:${requestTimestamp}`,
    `Request-Target:${requestTarget}`,
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
    const requestTarget = "/checkout/v1/payment";
    const url = String(ENV.DOKU_API_URL) + requestTarget;
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
        payment_method_types: [
          "VIRTUAL_ACCOUNT_BCA",
          "VIRTUAL_ACCOUNT_BANK_MANDIRI",
          "VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI",
          "VIRTUAL_ACCOUNT_DOKU",
          "VIRTUAL_ACCOUNT_BRI",
          "VIRTUAL_ACCOUNT_BNI",
          "VIRTUAL_ACCOUNT_BANK_PERMATA",
          "VIRTUAL_ACCOUNT_BANK_CIMB",
          "VIRTUAL_ACCOUNT_BANK_DANAMON",
          "ONLINE_TO_OFFLINE_ALFA",
          "CREDIT_CARD",
          "DIRECT_DEBIT_BRI",
          "EMONEY_SHOPEEPAY",
          "EMONEY_OVO",
          // "QRIS", Broken
          "PEER_TO_PEER_AKULAKU",
          "PEER_TO_PEER_KREDIVO",
          "PEER_TO_PEER_INDODANA",
        ],
      },
      customer: {
        email,
      },
    };

    const signatureParams = {
      requestID,
      requestTimestamp,
      clientId: String(ENV.DOKU_CLIENT_ID),
      requestTarget,
      jsonBody,
    };

    const signature = generateSignature(signatureParams);
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
