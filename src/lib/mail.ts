import nodemailer from "nodemailer";
import { ENV } from "../env";

const transporter = nodemailer.createTransport({
  host: ENV.SMTP_HOST,
  port: ENV.SMTP_PORT,
  auth: {
    user: ENV.SMTP_USER,
    pass: ENV.SMTP_PASS,
  },
});

type SendMailParams = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

export const sendMail = async (params: SendMailParams) => {
  const info = await transporter.sendMail(params);
  console.log(info);
  return info;
};
