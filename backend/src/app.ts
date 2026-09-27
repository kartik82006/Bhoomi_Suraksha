import "./env.js";

import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { openapiSpec } from "./openapi.js";
import { authRouter } from "./routes/auth.js";
import { habitationsRouter } from "./routes/habitations.js";
import { hazardsRouter } from "./routes/hazards.js";
import { prioritizationRouter } from "./routes/prioritization.js";
import { sitesRouter } from "./routes/sites.js";
import { summaryRouter } from "./routes/summary.js";
import { translateRouter } from "./routes/translate.js";

export const app = express();

const defaultOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];
const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : [...defaultOrigins];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use("/api/auth", authRouter);
app.use("/api/hazards", hazardsRouter);
app.use("/api/habitations", habitationsRouter);
app.use("/api/prioritization", prioritizationRouter);
app.use("/api/sites", sitesRouter);
app.use("/api/summary", summaryRouter);
app.use("/api/translate", translateRouter);
