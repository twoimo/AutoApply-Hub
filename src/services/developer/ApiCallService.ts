import { MicroServiceABC } from "@qillie/wheel-micro-service";
import axios from "axios";
import bcrypt from "bcrypt";
import sequelize, { Sequelize } from "sequelize";
const sharp = require("sharp");
const FileType = require("file-type");

/**
 * @name 스마트 스토어 API 요청 서비스
 * @domain api_call
 */
export default class ApiCallService extends MicroServiceABC {}
