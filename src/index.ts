import express from "express";
import { whatsappRouter } from "./whatsapp/controller";

export const app = express();

app.use(express.json());

app.get("/", async (req, res) => {
  res.send("Hello World!");
});
app.use("/whatsapp", whatsappRouter);

const port = 5500;
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
