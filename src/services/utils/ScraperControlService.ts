import moment from "moment";
import { ScraperServiceABC, sleep } from "@qillie/wheel-micro-service";
import _ from "lodash";
import sequelize from "sequelize";
import axios from "axios";
import puppeteer from "puppeteer";

/**
 * @name 사람인 스크래퍼
 * @description 사람인 웹사이트의 채용정보를 스크래핑하는 서비스
 */
export default class ScraperControlService extends ScraperServiceABC {
  /**
   * 사람인 웹사이트의 채용정보를 스크래핑하는 메소드
   * @method openSaramin
   * @description
   * - Puppeteer를 사용하여 브라우저를 실행하고 사람인 채용정보 페이지에 접속
   * - 2페이지부터 20페이지까지 순차적으로 접근
   * - 각 페이지에서 채용공고 항목을 수집
   * - 각 채용공고의 상세 페이지 링크를 추출하고 해당 페이지로 이동
   */
  public async openSaramin({}: {}) {
    // Puppeteer 브라우저 설정 및 실행
    const browser = await puppeteer.launch({
      headless: false, // 실제 브라우저를 화면에 표시
      defaultViewport: null, // 브라우저 창 크기를 자동으로 조절
      args: [
        "--disable-web-security", // 웹 보안 설정 비활성화 (CORS 우회)
        "--disable-features=IsolateOrigins,site-per-process", // 브라우저 프로세스 격리 비활성화
        "--allow-running-insecure-content", // 안전하지 않은 콘텐츠 실행 허용
      ],
    });

    // 새로운 브라우저 탭 생성
    const page = await browser.newPage();

    // 페이지 순회 (2~20 페이지)
    for (let i = 2; i <= 20; i++) {
      // 사람인 채용정보 목록 페이지 접속
      await page.goto(
        `https://www.saramin.co.kr/zf_user/jobs/list/domestic?page=${i}&loc_mcd=101000%2C102000&cat_kewd=2248%2C82%2C83%2C107%2C108%2C109&search_optional_item=n&search_done=y&panel_count=y&preview=y&isAjaxRequest=0&page_count=50&sort=RL&type=domestic&is_param=1&isSearchResultEmpty=1&isSectionHome=0&searchParamCount=2#searchTitle`
      );

      // 페이지 로딩 대기시간
      await sleep(2000);

      // 채용공고 목록 요소 수집
      const boxItemElementList = await page.$$(".box_item");
      const linkList: string[] = [];

      // 각 채용공고 항목에서 정보 추출
      for (const boxItemElement of boxItemElementList) {
        // 공고 정보가 있는 요소 찾기
        const notificatonInfoElement = await boxItemElement.$(
          ".notification_info"
        );

        if (notificatonInfoElement !== null) {
          // 링크 요소 찾기
          const linkElement = await notificatonInfoElement.$("a");

          if (linkElement !== null) {
            // 링크 주소 가져오기
            const link = await await page.evaluate(
              (element) => element.getAttribute("href"),
              linkElement
            );

            // 유효한 링크인 경우 목록에 추가
            if (link !== null) {
              linkList.push(link);
            }
          }
        }

        // 수집된 링크들에 대해 상세 페이지 방문
        for (const link of linkList) {
          console.log(`https://www.saramin.co.kr${link}`);
          //   await page.goto(`https://www.saramin.co.kr${link}`);

          // 상세 페이지 로딩 대기
          await sleep(1000);
        }
        // 다음 채용공고 처리 전 대기
        await sleep(2000);
      }
    }
  }
}
