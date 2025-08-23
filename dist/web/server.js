"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const admin_routes_1 = require("./routes/admin.routes");
const logger_service_1 = require("../services/logger.service");
const database_service_1 = require("../services/database.service");
const config_1 = require("../config/config");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use("/admin", admin_routes_1.adminRoutes);
app.listen(config_1.WEB_PORT, () => {
  logger_service_1.logger.info(
    `Web server running on port ${config_1.WEB_PORT}`,
  );
  (0, database_service_1.connectDB)();
});
