import { decode, JwtPayload } from "jsonwebtoken";
import { logger } from "../lib/logger";
import { Request, Response } from "express";
import { User } from "../users/services";
import { services } from "./services";
import { errorHandler } from "../lib/error-handler";
import { responseJson } from "../middleware/response";
import { Pagination } from "../lib/types";

type FindManyQuery = {
  page?: number;
  perPage?: number;
};

const findMany = async (req: Request, res: Response) => {
  logger.info(`[wa-notif-controller-findMany]`);
  try {
    const { page, perPage } = req.query as FindManyQuery;

    const accessToken = req.header("x-access-token") as string;
    const jwt = decode(accessToken) as JwtPayload & User;
    const limit = perPage ? Number(perPage) : 100;
    const offset = page && Number(page) > 1 ? (Number(page) - 1) * limit : 0;
    const payments = await services.findMany(
      {
        user_id: jwt.id,
      },
      offset,
      limit,
    );
    const { count } = await services.count({
      user_id: jwt.id,
    });
    const pagination: Pagination = {
      page: page ? Number(page) : 1,
      perPage: limit,
      total: Number(count),
      totalPages: Number(count) > limit ? Math.round(Number(count) / limit) : 1,
    };

    const json = responseJson(200, { payments, pagination }, "");
    res.status(500).json(json);
  } catch (err: any) {
    logger.error(`[wa-payment-controller-findMany]`, err);
    return errorHandler(err, res);
  }
};

export const controller = { findMany };
