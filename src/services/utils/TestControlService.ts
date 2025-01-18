import moment from "moment";
import { ScraperServiceABC, sleep } from "@qillie/wheel-micro-service";
import _ from "lodash";
import sequelize from "sequelize";
import axios from "axios";
import puppeteer from "puppeteer";

/**
 * @name 테스트 컨트롤 서비스
 */
export default class TestControlService extends ScraperServiceABC {}
