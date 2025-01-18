import { MicroServiceABC } from "@qillie/wheel-micro-service";
import ApiCallService from "./ApiCallService";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import _, { after } from "lodash";

/**
 * @name 데이터 컨버팅 (마이크로 서비스 -> 메인 서비스) 및 역컨버팅 (메인 서비스 -> 마이크로 서비스) 클래스
 * @domain data_converter
 */
export default class DataConverterService extends MicroServiceABC {
  // 네이버 커머스 API 호출 서비스
  private apiCallService = new ApiCallService([]);

  /**
   * @name 테스트
   */
  public test(data: any): any {
    // 테스트
    return {};
  }
}
