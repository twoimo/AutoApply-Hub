// 필요한 외부 라이브러리 임포트
import moment from "moment"; // 날짜/시간 처리 라이브러리
import { ScraperServiceABC, sleep } from "@qillie/wheel-micro-service"; // 마이크로서비스 기본 클래스와 유틸리티
import _ from "lodash"; // 유틸리티 함수 라이브러리
import sequelize from "sequelize"; // 데이터베이스 ORM
import axios from "axios"; // HTTP 클라이언트
import puppeteer from "puppeteer"; // 웹 스크래핑 라이브러리

/**
 * @name 사람인 스크래퍼
 * @description 사람인 웹사이트의 채용정보를 스크래핑하는 서비스 클래스
 */
export default class ScraperControlService extends ScraperServiceABC {
  /**
   * 사람인 채용정보 스크래핑 메소드
   * @method openSaramin
   * @description
   * - Puppeteer 브라우저를 실행하여 사람인 사이트에서 채용정보를 수집
   * - 2페이지부터 20페이지까지의 채용공고를 순차적으로 처리
   * - 각 페이지의 채용공고 목록을 수집하고 상세 페이지 링크 추출
   */
  public async openSaramin({}: {}) {
    // Puppeteer 브라우저 인스턴스 생성 및 설정
    const browser = await puppeteer.launch({
      headless: false, // 브라우저 화면 표시 모드 활성화
      defaultViewport: null, // 기본 뷰포트 설정 해제
      args: [
        "--disable-web-security", // 웹 보안 제한 해제 (CORS 우회용)
        "--disable-features=IsolateOrigins,site-per-process", // 프로세스 격리 기능 비활성화
        "--allow-running-insecure-content", // 비보안 콘텐츠 실행 허용
      ],
    });

    // 새 브라우저 탭 생성
    const page = await browser.newPage();

    // 페이지 순회 (2~20 페이지)
    for (let i = 2; i <= 20; i++) {
      // 사람인 채용정보 목록 페이지로 이동
      await page.goto(
        `https://www.saramin.co.kr/zf_user/jobs/list/domestic?page=${i}&loc_mcd=101000%2C102000&cat_kewd=2248%2C82%2C83%2C107%2C108%2C109&search_optional_item=n&search_done=y&panel_count=y&preview=y&isAjaxRequest=0&page_count=50&sort=RL&type=domestic&is_param=1&isSearchResultEmpty=1&isSectionHome=0&searchParamCount=2#searchTitle`
      );

      // 페이지 로딩 대기
      await sleep(2000);

      // 채용공고 아이템 요소들 수집
      const boxItemElementList = await page.$$(".box_item");
      const linkList: string[] = []; // 수집된 링크를 저장할 배열

      // 각 채용공고 아이템 처리
      for (const boxItemElement of boxItemElementList) {
        // 공고 정보 영역 선택
        const notificatonInfoElement = await boxItemElement.$(
          ".notification_info"
        );

        if (notificatonInfoElement !== null) {
          // 링크 요소 찾기
          const linkElement = await notificatonInfoElement.$("a");

          if (linkElement !== null) {
            // 링크 URL 추출
            const link = await await page.evaluate(
              (element) => element.getAttribute("href"),
              linkElement
            );

            // 유효한 링크인 경우 배열에 추가
            if (link !== null) {
              linkList.push(link);
            }
          }
        }

        // 수집된 링크들에 대한 처리
        for (const link of linkList) {
          console.log(`https://www.saramin.co.kr${link}`); // 링크 출력
          // await page.goto(`https://www.saramin.co.kr${link}`); // 상세 페이지 방문 (주석 처리됨)

          // 다음 링크 처리 전 대기
          await sleep(1000);
        }
        // 다음 채용공고 처리 전 대기
        await sleep(2000);
      }
    }
  }
}
