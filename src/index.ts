import express from "express";
import cors from "cors";
import { whatsappRouter } from "./whatsapp/controller";
import { ENV } from "./env";

export const app = express();

app.use(cors({ origin: ENV.ALLOW_ORIGIN }));
app.use(express.json());

app.use("/whatsapp", whatsappRouter);
app.get("/", async (req, res) => {
  res.send("Hello World!");
});

const port = 5500;
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
