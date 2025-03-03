// 필요한 외부 라이브러리들을 가져옵니다.
// import 구문: 다른 파일이나 라이브러리의 기능을 현재 파일에서 사용하기 위해 가져오는 문법입니다.
import moment from "moment";                                 // 날짜와 시간을 쉽게 다루는 라이브러리
import { ScraperServiceABC, sleep } from "@qillie/wheel-micro-service"; // 기본 스크래퍼 서비스와 대기 기능
import _ from "lodash";                                      // 유틸리티 함수 모음 라이브러리
import sequelize from "sequelize";                           // 데이터베이스 작업을 위한 ORM 라이브러리
import axios from "axios";                                   // HTTP 요청을 보내기 위한 라이브러리
import puppeteer from "puppeteer";                           // 웹 브라우저 자동화 라이브러리
import { Browser, Page } from "puppeteer";                   // 타입스크립트용 puppeteer 타입 정의

/**
 * 채용 공고 정보 인터페이스
 * 스크랩한 채용 공고의 정보를 담는 구조
 * 
 * 인터페이스란? 객체가 어떤 속성과 타입을 가져야 하는지 정의하는 '설계도'입니다.
 * 실제 데이터는 포함하지 않고 구조만 정의합니다.
 */
interface JobInfo {
  companyName: string;  // 회사명 (문자열 타입)
  jobTitle: string;     // 채용 제목 (문자열 타입)
  jobLocation: string;  // 근무지 위치 (문자열 타입)
  jobType: string;      // 채용 형태 (경력/신입 등) (문자열 타입)
  jobSalary: string;    // 급여 정보 (문자열 타입)
  deadline: string;     // 지원 마감일 (문자열 타입)
  url?: string;         // 원본 채용공고 URL (선택적 속성, ?는 이 속성이 없을 수도 있다는 의미)
}

/**
 * 스크래퍼 설정 인터페이스
 * 스크래퍼 동작을 제어하기 위한 설정값들을 정의합니다.
 * 
 * 모든 속성에 ?가 붙은 것은 '선택적 속성'으로, 반드시 값을 제공하지 않아도 된다는 의미입니다.
 */
interface ScraperConfig {
  startPage?: number;    // 스크랩 시작 페이지 번호 (선택적, 숫자 타입)
  endPage?: number;      // 스크랩 종료 페이지 번호 (선택적, 숫자 타입)
  headless?: boolean;    // 헤드리스 모드 여부 - true면 브라우저 UI가 보이지 않고, false면 보임 (선택적, 불리언 타입)
  waitTime?: number;     // 페이지 로딩 후 대기 시간(밀리초) - 페이지 완전히 로드되길 기다리는 시간 (선택적, 숫자 타입)
}

/**
 * @name 사람인 스크래퍼
 * @description 사람인 웹사이트의 채용정보를 자동으로 수집하는 서비스 클래스
 * 
 * 클래스란? 특정 객체를 생성하기 위한 템플릿이며, 속성(변수)과 메서드(함수)를 포함합니다.
 * extends ScraperServiceABC: ScraperServiceABC라는 기본 클래스의 기능을 상속받아 확장한다는 의미입니다.
 */
export default class ScraperControlService extends ScraperServiceABC {
  /**
   * 기본 스크래퍼 설정값
   * 사용자가 별도 설정을 제공하지 않을 때 사용되는 기본값들입니다.
   * 
   * private: 이 변수는 이 클래스 내부에서만 접근 가능하다는 의미입니다.
   */
  private defaultConfig: ScraperConfig = {
    startPage: 2,       // 기본 시작 페이지는 2페이지 (첫 페이지를 건너뜀)
    endPage: 20,        // 기본 종료 페이지는 20페이지 (2~20페이지까지 스크랩)
    headless: false,    // 기본적으로 브라우저 UI 표시 (디버깅하기 쉽게)
    waitTime: 2000      // 기본 대기 시간은 2초 (2000밀리초)
  };

  /**
   * 사람인 웹사이트의 채용정보를 스크래핑하는 메서드
   * 
   * @method openSaramin - 메서드(함수) 이름
   * @description
   * - Puppeteer를 사용해 실제 브라우저를 실행하고 사람인 채용정보 페이지에 접속합니다.
   * - 설정된 페이지 범위(startPage~endPage)를 순차적으로 접근합니다.
   * - 각 페이지에서 채용공고 항목을 수집합니다.
   * - 각 채용공고의 상세 페이지로 이동하여 자세한 정보를 수집합니다.
   * 
   * @param config - 스크래퍼 설정 객체 (선택적)
   * @returns - 수집된 채용정보 배열을 Promise 형태로 반환 (Promise란? 비동기 작업의 결과를 나타내는 객체)
   * 
   * public: 이 메서드는 클래스 외부에서 접근 가능하다는 의미입니다.
   * async: 비동기 함수로, 내부에서 await 키워드를 사용할 수 있게 해줍니다.
   */
  public async openSaramin(config: ScraperConfig = {}): Promise<JobInfo[]> {
    // 기본 설정과 사용자 제공 설정을 병합하고 undefined 값에 대해 기본값 설정
    // ?? 연산자: 왼쪽 값이 null이나 undefined면 오른쪽 값을 사용하는 논리 연산자
    const startPage = config.startPage ?? this.defaultConfig.startPage ?? 2;
    const endPage = config.endPage ?? this.defaultConfig.endPage ?? 20;
    const headless = config.headless ?? this.defaultConfig.headless ?? false;
    const waitTime = config.waitTime ?? this.defaultConfig.waitTime ?? 2000;
    
    let browser: Browser | null = null;      // 브라우저 객체를 저장할 변수 (초기값은 null)
    const collectedJobs: JobInfo[] = [];     // 수집된 채용정보를 저장할 배열 (빈 배열로 초기화)
    
    // 스크래핑 시작 메시지 콘솔에 출력
    console.log(`\n🚀 사람인 채용정보 스크래핑 시작`);
    console.log(`📄 페이지 범위: ${startPage} ~ ${endPage} 페이지`);
    console.log(`⚙️ 설정: 헤드리스 모드=${headless}, 대기 시간=${waitTime}ms\n`);

    // 스크래핑 시작 시간 기록 (성능 측정용)
    const startTime = Date.now();  // 현재 시간을 밀리초 단위로 가져옴

    try {
      // try-catch 구문: 오류가 발생할 수 있는 코드를 감싸고, 오류 시 프로그램이 중단되지 않도록 처리
      
      // 브라우저 초기화 (헤드리스 모드 설정에 따라)
      browser = await this.initializeBrowser(headless);
      // await: 비동기 작업이 완료될 때까지 기다린다는 의미
      const page = await browser.newPage();  // 새 브라우저 탭 열기
      
      // 페이지 로딩 타임아웃 설정 (30초)
      page.setDefaultTimeout(30000);  // 페이지 작업이 30초 이상 걸리면 오류 발생

      // 페이지 범위 내 각 페이지 처리
      // for 반복문: startPage부터 endPage까지 1씩 증가하며 반복
      for (let i = startPage; i <= endPage; i++) {
        console.log(`\n🔍 페이지 ${i} 스크래핑 시작...`);
        
        // 현재 페이지의 채용정보 수집 및 결과 배열에 저장
        const pageJobs = await this.processSaraminPage(page, i, waitTime);
        // ...연산자: 배열을 펼쳐서 개별 요소로 만들고, 이를 collectedJobs 배열에 추가
        collectedJobs.push(...pageJobs);
        
        console.log(`✅ 페이지 ${i} 완료: ${pageJobs.length}개의 채용공고 추출`);
      }
      
      // 스크래핑 결과 요약 출력
      this.printSummary(collectedJobs);
      
      // 소요 시간 계산 및 출력
      const endTime = Date.now();
      const elapsedTime = (endTime - startTime) / 1000; // 밀리초를 초 단위로 변환
      console.log(`⏱️ 총 소요 시간: ${elapsedTime.toFixed(2)}초`);  // 소수점 2자리까지 표시
      
      return collectedJobs;  // 수집된 모든 채용정보 반환
    } catch (error) {
      // 스크래핑 도중 오류 발생 시 로깅하고 지금까지 수집된 결과 반환
      console.error(`❌ 스크래핑 중 오류 발생:`, error);
      return collectedJobs;  // 오류 발생해도 지금까지 수집된 데이터는 반환
    } finally {
      // finally 블록: try나 catch 후에 항상 실행되는 코드
      
      // 오류 발생 여부와 관계없이 브라우저 종료 (리소스 정리를 위해 중요)
      if (browser) {  // browser가 null이 아닐 경우에만
        await browser.close();  // 브라우저 종료
        console.log(`🏁 브라우저 종료 및 스크래핑 완료`);
      }
    }
  }

  /**
   * 최적화된 설정으로 Puppeteer 브라우저를 초기화하는 메서드
   * 
   * @param headless - 헤드리스 모드 여부 (기본값: false, 브라우저 UI가 보임)
   * @returns - 초기화된 Puppeteer 브라우저 객체
   * 
   * private: 이 메서드는 클래스 내부에서만 호출 가능하다는 의미입니다.
   */
  private async initializeBrowser(headless: boolean = false): Promise<Browser> {
    // 브라우저 실행 옵션을 설정하고 브라우저 인스턴스 반환
    return puppeteer.launch({
      headless,  // 헤드리스 모드 설정 (true: UI 없음, false: UI 표시)
      defaultViewport: null,  // 뷰포트(화면) 크기를 자동으로 조정
      args: [
        // 브라우저 실행 시 전달할 명령줄 인자들 (다양한 보안 및 성능 설정)
        "--disable-web-security",              // 웹 보안 비활성화 (CORS 우회 - 다른 도메인 접근 허용)
        "--disable-features=IsolateOrigins,site-per-process",  // 사이트 격리 기능 비활성화
        "--allow-running-insecure-content",    // 안전하지 않은 컨텐츠 실행 허용
        "--no-sandbox",                        // 샌드박스 모드 비활성화 (성능 향상)
        "--disable-setuid-sandbox",            // setuid 샌드박스 비활성화
        "--disable-dev-shm-usage"              // 공유 메모리 사용 비활성화 (안정성 향상)
      ],
    });
  }

  /**
   * 사람인의 단일 채용 목록 페이지를 처리하는 메서드
   * 
   * @param page - Puppeteer 페이지 객체 (브라우저의 탭을 나타냄)
   * @param pageNum - 처리할 페이지 번호
   * @param waitTime - 페이지 로딩 후 대기 시간 (밀리초)
   * @returns - 페이지에서 수집된 채용정보 배열
   * 
   * private: 클래스 내부에서만 호출 가능
   */
  private async processSaraminPage(page: Page, pageNum: number, waitTime: number): Promise<JobInfo[]> {
    // 현재 페이지에서 수집된 채용정보를 저장할 배열
    const pageJobs: JobInfo[] = []; 
    
    try {
      // 채용 목록 페이지 URL 생성 및 페이지 이동
      const pageUrl = this.buildSaraminPageUrl(pageNum);
      // 페이지 이동 및 네트워크 요청이 완료될 때까지 대기 (페이지가 완전히 로드됨을 보장)
      await page.goto(pageUrl, { waitUntil: "networkidle2" }); 
      await sleep(waitTime); // 추가 로딩을 위한 대기 시간 (자바스크립트 등이 실행될 시간 확보)

      // 페이지에서 채용 공고 링크들을 추출
      const links = await this.extractJobLinks(page);
      console.log(`페이지 ${pageNum}: ${links.length}개의 채용공고를 발견했습니다`);

      // 각 채용 공고 링크에 대해 처리
      // for...of 반복문: 배열의 각 요소를 순회
      for (const link of links) {
        try {
          // 전체 URL 구성 및 채용 상세 정보 추출
          const fullUrl = `https://www.saramin.co.kr${link}`;
          const jobInfo = await this.extractJobDetails(page, fullUrl, waitTime);
          
          // 유효한 채용정보가 추출된 경우 결과 배열에 추가
          if (jobInfo) {
            jobInfo.url = fullUrl; // 원본 URL 저장 (나중에 참조하기 위해)
            pageJobs.push(jobInfo);
          }
        } catch (error) {
          // 개별 채용공고 처리 중 오류 발생 시 로깅 후 계속 진행
          // 하나의 채용공고에서 오류가 발생해도 전체 프로세스는 계속 진행
          console.error(`채용공고 정보 추출 오류: ${error}`);
          continue; // 다음 링크로 진행 (현재 반복을 건너뜀)
        }
      }
    } catch (error) {
      // 페이지 전체 처리 중 오류 발생 시 로깅
      console.error(`페이지 ${pageNum} 처리 중 오류 발생: ${error}`);
    }
    
    return pageJobs; // 수집된 채용정보 반환
  }

  /**
   * 사람인 특정 페이지의 URL을 생성하는 메서드
   * 
   * @param pageNum - 페이지 번호
   * @returns - 완성된 사람인 페이지 URL 문자열
   * 
   * private: 클래스 내부에서만 호출 가능
   */
  private buildSaraminPageUrl(pageNum: number): string {
    // IT/개발 직군 채용정보로 필터링된 URL 생성
    // 다양한 파라미터가 포함된 복잡한 URL을 구성
    // loc_mcd: 지역 코드, cat_kewd: 직종 카테고리 코드, page_count: 한 페이지당 결과 수 등
    return `https://www.saramin.co.kr/zf_user/jobs/list/domestic?page=${pageNum}&loc_mcd=101000%2C102000&cat_kewd=2248%2C82%2C83%2C107%2C108%2C109&search_optional_item=n&search_done=y&panel_count=y&preview=y&isAjaxRequest=0&page_count=50&sort=RL&type=domestic&is_param=1&isSearchResultEmpty=1&isSectionHome=0&searchParamCount=2#searchTitle`;
  }

  /**
   * 채용 목록 페이지에서 개별 채용공고의 링크들을 추출하는 메서드
   * 
   * @param page - Puppeteer 페이지 객체
   * @returns - 추출된 채용공고 링크 문자열 배열
   * 
   * private: 클래스 내부에서만 호출 가능
   */
  private async extractJobLinks(page: Page): Promise<string[]> {
    // 페이지 내 자바스크립트를 실행하여 링크 추출
    // page.evaluate: 브라우저 컨텍스트에서 함수를 실행하는 메서드
    return page.evaluate(() => {
      const linkList: string[] = [];  // 추출된 링크를 저장할 배열
      
      // 채용공고 항목 선택 (.box_item 클래스를 가진 요소들)
      // document.querySelectorAll: CSS 선택자와 일치하는 모든 요소를 찾는 메서드
      const boxItems = document.querySelectorAll(".box_item");

      // 각 채용공고 항목에서 링크 추출
      // forEach: 배열의 각 요소에 대해 함수를 실행
      boxItems.forEach((item) => {
        // 채용정보가 있는 컨테이너 요소 선택
        const notificationInfo = item.querySelector(".notification_info");
        if (notificationInfo) {
          // 링크 요소 찾기 및 href 속성 추출
          const linkElement = notificationInfo.querySelector("a");
          // 링크 요소가 존재하고 href 속성이 있는 경우에만 추가
          if (linkElement && linkElement.getAttribute("href")) {
            linkList.push(linkElement.getAttribute("href") || "");
            // || "": href가 null인 경우 빈 문자열로 대체 (타입 안전성 확보)
          }
        }
      });

      return linkList; // 수집된 링크 배열 반환
    });
  }

  /**
   * 채용공고 상세 페이지에서 세부 정보를 추출하는 메서드
   * 
   * @param page - Puppeteer 페이지 객체
   * @param url - 채용공고 상세 페이지 URL
   * @param waitTime - 페이지 로딩 후 대기 시간 (밀리초)
   * @returns - 추출된 채용정보 객체 또는 실패 시 null
   * 
   * private: 클래스 내부에서만 호출 가능
   */
  private async extractJobDetails(page: Page, url: string, waitTime: number): Promise<JobInfo | null> {
    try {
      // 처리 중인 URL 로깅 (디버깅 및 진행상황 추적 용도)
      console.log(`\n=============================`);
      console.log(`🔍 채용공고 상세 페이지 처리 시작: ${url}`);
      console.log(`=============================`);
      
      // 상세 페이지로 이동 및 로딩 대기
      await page.goto(url, { waitUntil: "networkidle2" });
      await sleep(waitTime);  // 추가 로딩 대기

      // 페이지 내 자바스크립트 실행하여 채용정보 추출
      // evaluate 내부 함수는 브라우저 컨텍스트에서 실행됨 (Puppeteer의 특성)
      const jobInfo = await page.evaluate(() => {
        // 채용정보가 포함된 컨테이너 요소 찾기
        const wrapContainer = document.querySelector(".wrap_jv_cont");
        if (!wrapContainer) return null; // 컨테이너가 없으면 정보 추출 불가능, null 반환

        /**
         * 선택자에서 텍스트 내용 추출하는 도우미 함수
         * @param selector - CSS 선택자 문자열
         * @returns - 추출된 텍스트 (없으면 빈 문자열)
         */
        const getTextContent = (selector: string): string => {
          const element = wrapContainer.querySelector(selector);
          // element가 있으면 textContent 속성 값을 trim(공백 제거)하여 반환, 없으면 빈 문자열
          // ?. : 선택적 체이닝 연산자, element가 null이면 undefined 반환
          // || : 왼쪽 값이 falsy(false, null, undefined 등)면 오른쪽 값 사용
          return element ? element.textContent?.trim() || "" : "";
        };

        /**
         * 마감일 정보 추출 도우미 함수
         * 여러 방식으로 날짜 정보를 찾아 추출
         * @returns - 추출된 마감일 문자열 (없으면 빈 문자열)
         */
        const extractDeadline = (): string => {
          // 마감일 관련 키워드가 포함된 텍스트 찾기
          // Array.from: 유사 배열 객체를 배열로 변환
          const allElements = Array.from(wrapContainer.querySelectorAll("*"));
          
          // 모든 요소를 순회하며 마감일 관련 텍스트 찾기
          for (const el of allElements) {
            const text = el.textContent || "";
            // includes: 문자열에 특정 텍스트가 포함되어 있는지 검사
            if (text.includes("마감일") || text.includes("접수기간") || 
                text.includes("모집기간") || text.includes("공고기간")) {
              // 날짜 패턴 찾기 (예: 2023-01-31, 2023.01.31)
              // 정규표현식: \d는 숫자, {n}은 n번 반복, [-./]는 하이픈, 점, 슬래시 중 하나
              const datePattern = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/g;
              // 시간 패턴 찾기 (예: 13:00)
              const timePattern = /\d{1,2}:\d{2}/g;
              
              // match: 문자열에서 정규표현식과 일치하는 부분을 배열로 반환
              const dateMatches = text.match(datePattern);
              const timeMatches = text.match(timePattern);
              
              // 날짜와 시간 조합하여 반환
              if (dateMatches) {
                return timeMatches 
                  ? `${dateMatches[0]} ${timeMatches[0]}` // 날짜와 시간 모두 있는 경우
                  : dateMatches[0]; // 날짜만 있는 경우
              }
            }
          }
          return ""; // 마감일 정보를 찾지 못한 경우 빈 문자열 반환
        };

        /**
         * DL/DT/DD 구조에서 정보 추출 도우미 함수
         * 제목(dt)과 값(dd)의 쌍으로 구성된 정보 추출
         * 
         * Record<string, string>: 키와 값이 모두 문자열인 객체 타입
         * @returns - 추출된 정보 객체 (키-값 쌍)
         */
        const extractInfoFromColumns = (): Record<string, string> => {
          const result: Record<string, string> = {};  // 빈 객체로 초기화
          // dl(definition list) 요소들 선택
          const dlElements = wrapContainer.querySelectorAll("dl");
          
          // 각 정의 리스트에서 제목(dt)과 값(dd)을 추출하여 객체로 변환
          dlElements.forEach((dl) => {
            // ?. : 선택적 체이닝 연산자, 앞의 값이 null/undefined면 undefined 반환
            const title = dl.querySelector("dt")?.textContent?.trim() || "";
            const value = dl.querySelector("dd")?.textContent?.trim() || "";
            // 제목과 값이 모두 존재하는 경우에만 객체에 추가
            if (title && value) result[title] = value;
          });
          
          return result;  // 수집된 정보 객체 반환
        };
        
        // 모든 컬럼 정보 추출
        const columnInfo = extractInfoFromColumns();
        
        // 회사명 추출 (여러 선택자 시도 - 첫 번째로 발견되는 요소 사용)
        const companyName = getTextContent(".company_name") || getTextContent(".corp_name");
        
        // 채용 제목 추출 (여러 선택자 시도 - 첫 번째로 발견되는 요소 사용)
        const jobTitle = getTextContent(".job_tit") || getTextContent("h1.tit_job");
        
        // 근무지 정보 추출 및 정리
        const jobLocation = columnInfo["근무지역"]?.replace(/지도/g, "").trim() || "";
        
        // 마감일 정보 추출 (여러 필드 시도)
        const deadline = columnInfo["접수기간"] || 
                         columnInfo["마감일"] || 
                         columnInfo["모집기간"] || 
                         columnInfo["공고기간"] || 
                         extractDeadline();
        
        // 급여 정보 추출 및 정리 (불필요한 부분 제거)
        let jobSalary = columnInfo["급여"] || columnInfo["급여조건"] || "";
        if (jobSalary) {
          jobSalary = jobSalary
            .split("상세보기")[0] // "상세보기" 텍스트 이전 부분만 사용
            .split("최저임금")[0] // "최저임금" 텍스트 이전 부분만 사용
            .trim(); // 앞뒤 공백 제거
        }
        
        // 추출한 정보를 객체로 구성하여 반환
        return {
          companyName,   // 회사명
          jobTitle,      // 채용 제목
          jobLocation,   // 근무지
          jobType: columnInfo["경력"] || columnInfo["경력조건"] || "", // 경력 조건
          jobSalary,     // 급여 정보
          deadline       // 마감일
        };
      });

      // 추출된 정보가 있으면 콘솔에 출력
      if (jobInfo) {
        console.log(`\n✅ 채용정보 추출 성공`);
        console.log(`------------------------------`);
        console.log(`🏢 회사명: ${jobInfo.companyName}`);
        console.log(`📝 채용제목: ${jobInfo.jobTitle}`);
        console.log(`📍 근무지역: ${jobInfo.jobLocation}`);
        console.log(`👨‍💼 경력조건: ${jobInfo.jobType}`);
        console.log(`💰 급여정보: ${jobInfo.jobSalary}`);
        console.log(`⏰ 마감일자: ${jobInfo.deadline}`);
        console.log(`🔗 원본URL: ${url}`);
        console.log(`------------------------------\n`);
      } else {
        console.log(`❌ 채용정보 추출 실패: 정보를 찾을 수 없습니다.`);
      }

      return jobInfo;
    } catch (error) {
      // 채용정보 추출 실패 시 로깅 및 null 반환
      console.error(`❌ ${url}에서 채용정보 추출 실패: ${error}`);
      return null;
    }
  }

  /**
   * 스크래핑 결과를 요약하여 콘솔에 출력
   * @param jobs 수집된 채용정보 배열
   */
  private printSummary(jobs: JobInfo[]): void {
    console.log(`\n=================================`);
    console.log(`📊 스크래핑 결과 요약`);
    console.log(`=================================`);
    console.log(`📋 총 수집된 채용공고 수: ${jobs.length}개`);
    
    // 회사별 채용공고 수 집계
    const companyCounts: Record<string, number> = {};
    jobs.forEach(job => {
      const company = job.companyName;
      companyCounts[company] = (companyCounts[company] || 0) + 1;
    });
    
    // 상위 5개 회사 표시
    const topCompanies = Object.entries(companyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    if (topCompanies.length > 0) {
      console.log(`\n🔝 채용공고가 많은 상위 회사:`);
      topCompanies.forEach(([company, count], index) => {
        console.log(`   ${index + 1}. ${company}: ${count}개`);
      });
    }
    
    // 경력 조건별 통계
    const jobTypeCounts: Record<string, number> = {};
    jobs.forEach(job => {
      const type = job.jobType || '미지정';
      jobTypeCounts[type] = (jobTypeCounts[type] || 0) + 1;
    });
    
    console.log(`\n📊 경력 조건별 채용공고:`);
    Object.entries(jobTypeCounts).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}개`);
    });
    
    console.log(`=================================\n`);
  }
}
