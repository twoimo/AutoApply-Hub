import axios from "axios";
import moment from "moment";
import TestTable from "../../models/TestTable";

/** 테스트 서비스
 * @name 테스트 서비스
 * @domain test
 */
export default class TestService {
  /**
   * @name 테스트 멤버
   */
  private testMember = "QILLIE CORP";

  /** 연결해보기 API
   * @name 연결해보기 API
   * @httpMethod get
   * @path /connect
   * @objectParams {string} text - 유저명
   */
  public async connect({ text }: { text: string }): Promise<{
    [key: string]: any;
  }> {
    try {
      // 테스트 테이블로부터 데이터 탐색
      const test = await TestTable.findOne({
        where: {
          name: text,
        },
      });

      // 연결 테스트
      const message = "안녕하세요, " + text + "님! from " + this.testMember;

      return { message };
    } catch (error) {
      console.error("연결 전송 실패:", error);
      throw error;
    }
  }
}
