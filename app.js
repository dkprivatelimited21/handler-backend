import express, { json } from "express";
import ErrorHandler from "./middleware/error";
const app = express();
import cookieParser from "cookie-parser";
import { urlencoded } from "body-parser";
import cors from "cors";

app.use(cors({
  origin: ['https://local-handler.vercel.app',],
  credentials: true
}));

app.use(json());
app.use(cookieParser());
app.use("/test", (req, res) => {
  res.send("Hello world!");
});

app.use(urlencoded({ extended: true, limit: "50mb" }));

// config
if (process.env.NODE_ENV !== "PRODUCTION") {
  require("dotenv").config({
    path: "config/.env",
  });
}

// import routes
import user from "./controller/user";
import shop from "./controller/shop";
import product from "./controller/product";
import event from "./controller/event";
import coupon from "./controller/coupounCode";
import payment from "./controller/payment";
import order from "./controller/order";
import conversation from "./controller/conversation";
import message from "./controller/message";
import withdraw from "./controller/withdraw";

app.use("/api/v2/user", user);
app.use("/api/v2/conversation", conversation);
app.use("/api/v2/message", message);
app.use("/api/v2/order", order);
app.use("/api/v2/shop", shop);
app.use("/api/v2/product", product);
app.use("/api/v2/event", event);
app.use("/api/v2/coupon", coupon);
app.use("/api/v2/payment", payment);
app.use("/api/v2/withdraw", withdraw);

// it's for ErrorHandling
app.use(ErrorHandler);

export default app;
