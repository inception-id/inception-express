import { decode, JwtPayload } from "jsonwebtoken";
import { logger } from "../lib/logger";
import { Request, Response } from "express";
import { User } from "../users/services";
import { services, WhatsappPayment, WhatsappPaymentStatus } from "./services";
import { errorHandler } from "../lib/error-handler";
import { responseJson } from "../middleware/response";
import { doku } from "./doku";
import { ENV } from "../env";

const findMany = async (req: Request, res: Response) => {
  logger.info(`[wa-payment-controller-findMany]`);
  try {
    const accessToken = req.header("x-access-token") as string;
    const jwt = decode(accessToken) as JwtPayload & User;
    const payments = await services.findMany({
      user_id: jwt.id,
    });

    const json = responseJson(200, payments, "");
    res.status(200).json(json);
  } catch (err: any) {
    logger.error(`[wa-payment-controller-findMany]`, err);
    return errorHandler(err, res);
  }
};

const create = async (req: Request, res: Response) => {
  logger.info(`[wa-payment-controller-findOne]`);
  try {
    const { id } = req.params;
    const accessToken = req.header("x-access-token") as string;
    const jwt = decode(accessToken) as JwtPayload & User;
    const payment = await services.find({ id });
    if (payment?.id) {
      const dokuPayment = await doku.initiatePayment(
        jwt.email,
        Number(payment?.amount),
      );

      const updateParams: Partial<WhatsappPayment> = {
        doku_request: JSON.stringify(dokuPayment.dokuRequest),
        doku_response: JSON.stringify(dokuPayment.dokuResponse),
      };
      const updatedPayment = await services.update(
        { id: payment?.id },
        updateParams,
      );
      const json = responseJson(200, updatedPayment[0], "");
      return res.status(200).json(json);
    }

    const json = responseJson(500, null, "");
    return res.status(500).json(json);
  } catch (err: any) {
    logger.error(`[wa-payment-controller-findOne]`, err);
    return errorHandler(err, res);
  }
};

type DokuBodySchema = {
  order: {
    invoice_number: string;
    amount: number;
  };
  transaction: {
    date: string;
    original_request_id: string;
  };
};

const callbackDoku = async (req: Request, res: Response) => {
  logger.info(`[wa-payment-callbackDoku]`);

  try {
    const { "client-id": clientId } = req.headers;
    if (clientId !== ENV.DOKU_CLIENT_ID) {
      const json = responseJson(401, null, "Unauthorized");
      return res.status(401).json(json);
    }
    const body = req.body satisfies DokuBodySchema;
    const invoiceNumber = body.order.invoice_number;
    const originalRequestId = body.transaction.original_request_id;
    const payment = await services.findDokuPayment(
      invoiceNumber,
      originalRequestId,
    );
    if (payment?.id) {
      const updatedPayment = await services.update(
        { id: payment.id },
        {
          doku_notif: JSON.stringify(body),
          payment_status: WhatsappPaymentStatus.PAID,
          paid_at: new Date(),
        },
      );
      const json = responseJson(200, updatedPayment, "");
      return res.status(200).json(json);
    }

    const json = responseJson(400, null, "");
    return res.status(400).json(json);
  } catch (err: any) {
    logger.error(`[wa-payment-callbackDoku]`, err);
    return errorHandler(err, res);
  }
};

export const controller = { findMany, create, callbackDoku };
