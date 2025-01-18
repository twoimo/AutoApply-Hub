import { MicroServiceABC } from "@qillie/wheel-micro-service";
import ApiCallService from "./ApiCallService";

/**
 * @name 일회성 데이터 API 호출 클래스
 * @domain initial_data_setter
 */
export default class InitialDataSetterService extends MicroServiceABC {
  /**
   * API 호출 서비스
   */
  private apiCallService = new ApiCallService([]);

  /**
   * @name 테스트
   */
  public async test(): Promise<void> {}
}
