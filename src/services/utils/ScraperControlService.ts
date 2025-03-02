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
   * - Puppeteer를 사용하여 브라우저를 실행하고 사람인 채용정보 페이지에 접속합니다
   * - 2페이지부터 20페이지까지 순차적으로 접근합니다
   * - 각 페이지에서 채용공고 항목을 수집합니다
   * - 각 채용공고의 상세 페이지 링크를 추출하고 해당 페이지로 이동하여 정보를 수집합니다
   */
  public async openSaramin({}: {}) {
    // Puppeteer 브라우저 설정 및 실행 (헤드리스 모드 끔 - 브라우저 화면 표시)
    const browser = await puppeteer.launch({
      headless: false, // 실제 브라우저가 화면에 표시됩니다
      defaultViewport: null, // 기본 뷰포트 설정을 사용하지 않습니다
      args: [
        "--disable-web-security", // 웹 보안 기능 비활성화
        "--disable-features=IsolateOrigins,site-per-process", // 사이트 격리 기능 비활성화
        "--allow-running-insecure-content", // 안전하지 않은 콘텐츠 실행 허용
      ],
    });

    // 새로운 브라우저 탭 생성
    const page = await browser.newPage();

    try {
      // 사람인 채용정보 페이지 순회 (2~20 페이지)
      for (let i = 2; i <= 20; i++) {
        // 사람인 채용정보 목록 페이지 접속 (IT/개발 직군 필터링된 URL)
        await page.goto(
          `https://www.saramin.co.kr/zf_user/jobs/list/domestic?page=${i}&loc_mcd=101000%2C102000&cat_kewd=2248%2C82%2C83%2C107%2C108%2C109&search_optional_item=n&search_done=y&panel_count=y&preview=y&isAjaxRequest=0&page_count=50&sort=RL&type=domestic&is_param=1&isSearchResultEmpty=1&isSectionHome=0&searchParamCount=2#searchTitle`,
          { waitUntil: "networkidle2" } // 네트워크 통신이 완전히 끝날 때까지 기다립니다
        );

        // 페이지 콘텐츠가 완전히 로드될 때까지 2초 대기
        await sleep(2000);

        // 채용공고 목록에서 상세페이지 링크 추출
        const links = await page.evaluate(() => {
          const linkList: string[] = [];
          // 채용 공고 아이템을 모두 선택합니다
          const boxItems = document.querySelectorAll(".box_item");

          // 각 채용 공고 아이템에서 링크 추출
          boxItems.forEach((item) => {
            const notificationInfo = item.querySelector(".notification_info");
            if (notificationInfo) {
              const linkElement = notificationInfo.querySelector("a");
              if (linkElement && linkElement.getAttribute("href")) {
                linkList.push(linkElement.getAttribute("href") || "");
              }
            }
          });

          return linkList;
        });

        // 수집된 각 채용공고 링크에 대해 상세 페이지 방문 및 정보 수집
        for (const link of links) {
          const fullUrl = `https://www.saramin.co.kr${link}`;
          console.log(`방문 중인 URL: ${fullUrl}`);

          try {
            // 채용 상세 페이지로 이동
            await page.goto(fullUrl, { waitUntil: "networkidle2" });
            await sleep(2000); // 페이지 콘텐츠 로딩을 위한 대기 시간

            // 페이지에서 채용 정보 추출 - wrap_jv_cont 클래스 내부 내용으로 타겟팅
            const jobInfo = await page.evaluate(() => {
              // wrap_jv_cont 클래스 요소 찾기
              const wrapContainer = document.querySelector(".wrap_jv_cont");

              if (!wrapContainer) {
                return { error: "wrap_jv_cont container not found" };
              }

              // 특정 선택자에서 텍스트 내용을 추출하는 헬퍼 함수 (지정된 컨테이너 내에서만 검색)
              const getTextContent = (selector: string): string => {
                const element = wrapContainer.querySelector(selector);
                return element ? element.textContent?.trim() || "" : "";
              };

              // 마감일 정보를 별도로 추출하는 함수 추가
              const extractDeadline = () => {
                // 마감일이 포함될 수 있는 다양한 선택자 시도
                const deadlineSelectors = [
                  ".info_period", // 일반적인 마감일 컨테이너
                  ".date", // 날짜 클래스
                  "dl dt:contains('마감일'), dl dt:contains('접수기간'), dl dt:contains('모집기간')", // DL/DT 요소에서 검색
                ];

                // 텍스트 내용에 '마감일' 또는 '접수기간'이 포함된 요소 찾기
                const allText = Array.from(wrapContainer.querySelectorAll("*"))
                  .map((el) => el.textContent || "")
                  .find(
                    (text) =>
                      text.includes("마감일") ||
                      text.includes("접수기간") ||
                      text.includes("모집기간") ||
                      text.includes("공고기간")
                  );

                // 날짜 형식 추출 (YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD) 및 시간(HH:MM) 패턴
                if (allText) {
                  // 날짜 패턴 찾기 (YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD)
                  const datePattern = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/g;
                  const timePattern = /\d{1,2}:\d{2}/g;

                  const dateMatches = allText.match(datePattern);
                  const timeMatches = allText.match(timePattern);

                  let result = "";
                  if (dateMatches) result += dateMatches[0];
                  if (timeMatches) result += " " + timeMatches[0];

                  return result.trim();
                }
                return "";
              };

              // 회사명 추출
              const companyName =
                getTextContent(".company_name") || getTextContent(".corp_name");

              // 채용 제목 추출
              const jobTitle =
                getTextContent(".job_tit") || getTextContent("h1.tit_job");

              // 상세 정보를 컬럼에서 추출하는 함수
              const extractInfoFromColumns = () => {
                const result: any = {};

                // wrap_jv_cont 내부의 정보 컬럼을 찾습니다
                const columns = wrapContainer.querySelectorAll(".col");

                columns.forEach((column) => {
                  // 각 컬럼 내부의 dl(정의 리스트) 요소 찾기
                  const dlElements = column.querySelectorAll("dl");

                  dlElements.forEach((dl) => {
                    // dt는 항목명, dd는 항목값에 해당
                    const title =
                      dl.querySelector("dt")?.textContent?.trim() || "";
                    const value =
                      dl.querySelector("dd")?.textContent?.trim() || "";

                    if (title && value) {
                      result[title] = value;
                    }
                  });
                });

                return result;
              };

              // HTML 내용 전체를 가져오기 (선택적)
              const fullHtmlContent = wrapContainer.innerHTML;

              // 모든 컬럼 정보 추출
              const columnInfo = extractInfoFromColumns();

              // 근무 지역 정보 추출
              const jobLocation =
                columnInfo["근무지역"]?.replace(/지도/g, "").trim() || "";

              // 마감일 정보 추출 (여러 방법 시도)
              let rawDeadline =
                columnInfo["접수기간"] ||
                columnInfo["마감일"] ||
                columnInfo["모집기간"] ||
                columnInfo["공고기간"] ||
                extractDeadline();

              // 마감일에서 날짜와 시간만 추출
              const dateTimePattern =
                /\d{4}[-./]\d{1,2}[-./]\d{1,2}(?:\s*\d{1,2}:\d{2})?/g;
              const deadlineMatches = rawDeadline.match(dateTimePattern);
              const deadline = deadlineMatches
                ? deadlineMatches[0]
                : rawDeadline;

              // 수집된 정보 반환
              return {
                companyName, // 회사명
                jobTitle, // 채용 제목
                jobLocation, // 근무지
                jobType: columnInfo["경력"] || columnInfo["경력조건"] || "", // 경력 조건
                jobSalary: (columnInfo["급여"] || columnInfo["급여조건"] || "")
                  .split("상세보기")[0] // "상세보기" 텍스트 이후의 내용 제거
                  .split("최저임금")[0] // "최저임금" 텍스트 이후의 내용 제거
                  .trim(), // 앞뒤 공백 제거
                deadline, // 개선된 마감일 추출 방식
                // allColumnInfo: columnInfo, // 모든 추출된 컬럼 정보
                // fullHtmlContent // HTML 전체 내용이 필요하면 주석 해제
              };
            });

            // 추출된 채용 정보를 콘솔에 출력 (JSON 형태로 깔끔하게 표시)
            console.log(JSON.stringify(jobInfo, null, 2));
          } catch (error) {
            // 특정 URL 처리 중 오류 발생 시 로깅
            console.error(`URL 처리 중 오류 발생 (${fullUrl}):`, error);
          }

          // 다음 채용공고로 이동하기 전 잠시 대기 (서버 부하 방지)
          await sleep(2000);
        }
      }
    } catch (error) {
      // 전체 스크래핑 과정 중 발생한 오류 처리
      console.error("스크래핑 오류 발생:", error);
    } finally {
      // 작업 완료 후 브라우저 종료 (리소스 정리)
      await browser.close();
    }
  }
}
