#!/usr/bin/env node

import dotenv from "dotenv";
import path from "path";

// Load from current working directory
dotenv.config();

// Also load from the CLI project/installation root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { runCLI } from "./cli/index";

runCLI(process.argv);