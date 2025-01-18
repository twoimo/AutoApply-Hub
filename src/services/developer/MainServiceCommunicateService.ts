import { MicroServiceABC, sleep } from "@qillie/wheel-micro-service";
import ApiCallService from "./ApiCallService";
import DataConverterService from "./DataConverterService";
import axios from "axios";
import moment from "moment";
import sequelize from "sequelize";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import TestControlService from "../utils/TestControlService";

/**
 * @name 메인 서비스 노출 클래스
 * @domain main_service_communicate
 */
export default class MainServiceCommunicateService extends MicroServiceABC {
  /**
   * API 호출 서비스
   */
  private apiCallService = new ApiCallService([]);

  /**
   * 데이터 컨버터 서비스
   */
  private dataConverterService = new DataConverterService([]);

  /**
   * 테스트 컨트롤 서비스
   */
  private testControlService = new TestControlService([]);

  /**
   * @name 테스트
   * @httpMethod get
   * @path /test
   */
  public async test({}: {}) {}
}
