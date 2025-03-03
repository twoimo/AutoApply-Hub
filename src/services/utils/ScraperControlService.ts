// 필요한 외부 라이브러리들을 가져옵니다.
// import 구문: 다른 파일이나 라이브러리의 기능을 현재 파일에서 사용할 수 있게 가져오는 명령어입니다.
import moment from "moment";                                 // 날짜와 시간을 쉽게 다루는 라이브러리 (예: 날짜 포맷 변환, 계산 등)
import { ScraperServiceABC, sleep } from "@qillie/wheel-micro-service"; // 기본 스크래퍼 서비스 클래스와 실행 지연(대기) 함수
import _ from "lodash";                                      // 배열, 객체 등을 편리하게 다룰 수 있는 유틸리티 함수 모음 라이브러리
import sequelize from "sequelize";                           // 데이터베이스 작업을 위한 ORM(Object Relational Mapping) 라이브러리
import axios from "axios";                                   // HTTP 요청(API 호출 등)을 보내기 위한 라이브러리
import puppeteer from "puppeteer";                           // 웹 브라우저 자동화 라이브러리 (실제 Chrome 브라우저 제어)
import { Browser, Page } from "puppeteer";                   // puppeteer에서 사용하는 Browser와 Page 타입을 가져옴 (타입스크립트 타입 정의)

/**
 * 채용 공고 정보 인터페이스 - 스크랩한 채용 공고의 정보를 담는 구조
 * 
 * 인터페이스란? 객체의 구조(설계도)를 정의하는 것으로, 어떤 속성들이 있어야 하고 
 * 각 속성이 어떤 타입(종류)인지 미리 정해둔 것입니다.
 * 실제 데이터는 포함하지 않고, 데이터의 형태만 정의합니다.
 * 
 * 예를 들어, 아래 인터페이스는 "JobInfo라는 객체는 회사명, 채용제목 등의 속성을 
 * 반드시 가져야 하며, 각 속성은 문자열 타입이어야 한다"를 의미합니다.
 */
interface JobInfo {
  companyName: string;  // 회사명 (문자열 타입) - 예: "삼성전자", "네이버" 등
  jobTitle: string;     // 채용 제목 (문자열 타입) - 예: "프론트엔드 개발자 채용"
  jobLocation: string;  // 근무지 위치 (문자열 타입) - 예: "서울시 강남구"
  jobType: string;      // 채용 형태 (문자열 타입) - 예: "신입", "경력 3년 이상"
  jobSalary: string;    // 급여 정보 (문자열 타입) - 예: "3,000만원 이상", "회사 내규에 따름"
  deadline: string;     // 지원 마감일 (문자열 타입) - 예: "2023-12-31"
  url?: string;         // 원본 채용공고 URL (문자열 타입, ?는 이 속성이 없어도 된다는 의미, 선택적 속성)
                        // 예: "https://www.saramin.co.kr/job/123456"
}

/**
 * 스크래퍼 설정 인터페이스 - 스크래퍼 동작 방식을 제어하는 설정값 구조
 * 
 * 모든 속성에 ?가 붙은 것은 '선택적 속성'으로, 
 * 이 속성들은 반드시 제공하지 않아도 된다는 의미입니다.
 * 즉, 일부 설정만 변경하고 나머지는 기본값을 사용할 수 있습니다.
 */
interface ScraperConfig {
  startPage?: number;    // 스크랩 시작 페이지 번호 (선택적, 숫자 타입) - 예: 1, 2, 3...
  endPage?: number;      // 스크랩 종료 페이지 번호 (선택적, 숫자 타입) - 예: 10, 20...
  headless?: boolean;    // 헤드리스 모드 여부 (선택적, 불리언(참/거짓) 타입)
                         // true면 브라우저 화면이 보이지 않고, false면 실제 브라우저가 화면에 표시됨
  waitTime?: number;     // 페이지 로딩 후 대기 시간(밀리초) (선택적, 숫자 타입)
                         // 페이지가 완전히 로드되길 기다리는 시간 - 예: 1000 (1초), 2000 (2초)...
}

/**
 * @name 사람인 스크래퍼
 * @description 사람인 웹사이트의 채용정보를 자동으로 수집하는 서비스 클래스
 * 
 * 클래스란? 비슷한 특성과 기능을 가진 코드들을 묶어놓은 '틀'입니다.
 * 속성(변수)과 메서드(함수)를 포함하며, 이 틀을 기반으로 객체를 생성할 수 있습니다.
 * 
 * extends ScraperServiceABC는 "상속"이라는 개념으로,
 * ScraperServiceABC라는 기본 클래스의 기능을 물려받아 확장한다는 의미입니다.
 * 마치 '자동차'라는 기본 클래스를 확장해서 '스포츠카' 클래스를 만드는 것과 비슷합니다.
 * 
 * export default는 이 클래스를 다른 파일에서 import 할 수 있게 내보낸다는 의미입니다.
 */
export default class ScraperControlService extends ScraperServiceABC {
  /**
   * 기본 스크래퍼 설정값
   * 사용자가 별도 설정을 제공하지 않을 때 사용되는 기본값들입니다.
   * 
   * private 키워드는 이 변수가 이 클래스 내부에서만 접근 가능하다는 의미입니다.
   * 클래스 외부에서는 이 변수에 직접 접근할 수 없습니다.
   */
  private defaultConfig: ScraperConfig = {
    startPage: 2,       // 기본 시작 페이지는 2페이지 (첫 페이지를 건너뜀)
    endPage: 20,        // 기본 종료 페이지는 20페이지 (2~20페이지까지 스크랩)
    headless: false,    // 기본적으로 브라우저 UI 표시 (false이므로 브라우저가 화면에 보임, 디버깅하기 쉽게)
    waitTime: 2000      // 기본 대기 시간은 2초 (2000밀리초)
  };

  /**
   * 사람인 웹사이트의 채용정보를 스크래핑하는 메서드
   * 
   * @method openSaramin - 메서드(함수) 이름
   * @description
   * - Puppeteer를 사용해 실제 크롬 브라우저를 실행하고 사람인 채용정보 페이지에 접속합니다.
   * - 설정된 페이지 범위(startPage~endPage)를 순차적으로 접근합니다.
   * - 각 페이지에서 채용공고 항목을 수집합니다.
   * - 각 채용공고의 상세 페이지로 이동하여 자세한 정보를 수집합니다.
   * 
   * @param config - 스크래퍼 설정 객체 (선택적) - 사용자가 기본 설정을 변경하고 싶을 때 전달하는 값
   * @returns - 수집된 채용정보 배열을 Promise 형태로 반환
   *   (Promise란? 비동기 작업의 최종 완료 또는 실패를 나타내는 객체로, 
   *    미래에 완료될 예정인 작업의 결과값을 담고 있습니다.)
   * 
   * public: 이 메서드는 클래스 외부에서 접근 가능하다는 의미입니다.
   * async: 비동기 함수로, 내부에서 await 키워드를 사용할 수 있게 해줍니다.
   *   (비동기란? 작업이 완료될 때까지 기다리지 않고 다음 코드를 실행하는 방식입니다.
   *    웹 스크래핑처럼 시간이 오래 걸리는 작업을 효율적으로 처리할 수 있게 해줍니다.)
   */
  public async openSaramin(config: ScraperConfig = {}): Promise<JobInfo[]> {
    // 기본 설정과 사용자 제공 설정을 병합하고 undefined 값에 대해 기본값 설정
    // ?? 연산자: 널 병합 연산자로, 왼쪽 값이 null이나 undefined면 오른쪽 값을 사용하는 논리 연산자
    // 예: x ?? y 는 x가 null이나 undefined면 y를, 그렇지 않으면 x를 반환합니다.
    const startPage = config.startPage ?? this.defaultConfig.startPage ?? 2;
    const endPage = config.endPage ?? this.defaultConfig.endPage ?? 20;
    const headless = config.headless ?? this.defaultConfig.headless ?? false;
    const waitTime = config.waitTime ?? this.defaultConfig.waitTime ?? 2000;
    
    let browser: Browser | null = null;      // 브라우저 객체를 저장할 변수 (초기값은 null)
                                            // Browser는 Puppeteer에서 제공하는 타입으로, 실제 브라우저 인스턴스를 나타냄
    const collectedJobs: JobInfo[] = [];     // 수집된 채용정보를 저장할 배열 (빈 배열로 초기화)
                                            // JobInfo[]는 "JobInfo 타입의 배열"을 의미함
    
    // 스크래핑 시작 메시지 콘솔에 출력
    // console.log는 콘솔(터미널)에 텍스트를 출력하는 함수입니다.
    console.log(`\n🚀 사람인 채용정보 스크래핑 시작`);  // \n은 줄바꿈 문자입니다.
    console.log(`📄 페이지 범위: ${startPage} ~ ${endPage} 페이지`);
    console.log(`⚙️ 설정: 헤드리스 모드=${headless}, 대기 시간=${waitTime}ms\n`);

    // 스크래핑 시작 시간 기록 (성능 측정용)
    const startTime = Date.now();  // 현재 시간을 밀리초 단위로 가져옴
                                  // Date.now()는 1970년 1월 1일부터 현재까지의 밀리초를 반환합니다.

    try {
      // try-catch 구문: 오류가 발생할 수 있는 코드를 감싸고, 오류 발생 시 프로그램이 중단되지 않도록 처리합니다.
      // try 블록에서 오류가 발생하면 catch 블록으로 넘어가 오류를 처리합니다.
      
      // 브라우저 초기화 (헤드리스 모드 설정에 따라 실제 브라우저 화면 표시 여부 결정)
      browser = await this.initializeBrowser(headless);
      // await: 비동기 작업이 완료될 때까지 기다린다는 의미로, Promise가 완료될 때까지 함수 실행을 일시 중지합니다.
      // 브라우저 초기화가 끝날 때까지 기다린 후 다음 코드로 넘어갑니다.
      const page = await browser.newPage();  // 새 브라우저 탭(페이지) 열기
      
      // 페이지 로딩 타임아웃 설정 (30초)
      page.setDefaultTimeout(30000);  // 페이지 작업(로딩, 이동 등)이 30초(30,000밀리초) 이상 걸리면 오류 발생
                                     // 무한 대기 상태 방지를 위한 안전장치

      // 페이지 범위 내 각 페이지 처리
      // for 반복문: startPage부터 endPage까지 1씩 증가하며 반복
      // 예: startPage가 2, endPage가 5라면 i는 2, 3, 4, 5 순으로 증가하며 반복문 실행
      for (let i = startPage; i <= endPage; i++) {
        console.log(`\n🔍 페이지 ${i} 스크래핑 시작...`);
        
        // 현재 페이지의 채용정보 수집 및 결과 배열에 저장
        const pageJobs = await this.processSaraminPage(page, i, waitTime);
        // ...연산자(스프레드 연산자): 배열을 펼쳐서 개별 요소로 만듭니다.
        // 예: [1, 2, 3]을 ...[1, 2, 3]으로 펼치면 1, 2, 3이 됩니다.
        // push(...pageJobs)는 pageJobs 배열의 각 요소를 collectedJobs 배열에 개별적으로 추가합니다.
        collectedJobs.push(...pageJobs);
        
        console.log(`✅ 페이지 ${i} 완료: ${pageJobs.length}개의 채용공고 추출`);
      }
      
      // 스크래핑 결과 요약 출력
      this.printSummary(collectedJobs);
      
      // 소요 시간 계산 및 출력
      const endTime = Date.now();  // 현재 시간(종료 시간)
      const elapsedTime = (endTime - startTime) / 1000; // 밀리초를 초 단위로 변환 (1초 = 1000밀리초)
      console.log(`⏱️ 총 소요 시간: ${elapsedTime.toFixed(2)}초`);  // toFixed(2)는 소수점 2자리까지만 표시
      
      return collectedJobs;  // 수집된 모든 채용정보 반환 (함수 종료)
    } catch (error) {
      // 스크래핑 도중 오류 발생 시 로깅하고 지금까지 수집된 결과 반환
      console.error(`❌ 스크래핑 중 오류 발생:`, error);  // console.error는 오류 메시지 출력용 함수
      return collectedJobs;  // 오류 발생해도 지금까지 수집된 데이터는 반환
    } finally {
      // finally 블록: try나 catch 후에 항상 실행되는 코드
      // 성공하든 실패하든 반드시 실행해야 하는 코드를 여기에 작성합니다.
      
      // 오류 발생 여부와 관계없이 브라우저 종료 (리소스 정리를 위해 중요)
      if (browser) {  // browser가 null이 아닐 경우에만 (browser가 성공적으로 초기화된 경우)
        await browser.close();  // 브라우저 종료 (메모리 등 시스템 자원 해제)
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
   * 클래스 외부에서는 이 메서드를 직접 호출할 수 없습니다.
   */
  private async initializeBrowser(headless: boolean = false): Promise<Browser> {
    // 브라우저 실행 옵션을 설정하고 브라우저 인스턴스 반환
    // puppeteer.launch()는 새로운 브라우저 인스턴스를 시작하는 함수입니다.
    return puppeteer.launch({
      headless,  // 헤드리스 모드 설정 (true: UI 없음, false: UI 표시)
                 // 변수명과 값이 같을 때는 headless: headless처럼 쓰지 않고 줄여서 작성 가능
      defaultViewport: null,  // 뷰포트(화면) 크기를 자동으로 조정 (null은 브라우저 창 크기에 맞춤)
      args: [
        // 브라우저 실행 시 전달할 명령줄 인자(옵션)들 (다양한 보안 및 성능 설정)
        "--disable-web-security",              // 웹 보안 비활성화 (CORS 우회 - 다른 도메인의 리소스 접근 허용)
        "--disable-features=IsolateOrigins,site-per-process",  // 사이트 격리 기능 비활성화
        "--allow-running-insecure-content",    // 안전하지 않은 컨텐츠 실행 허용 (http와 https 혼합 허용)
        "--no-sandbox",                        // 샌드박스 모드 비활성화 (성능 향상, 단 보안은 약화)
        "--disable-setuid-sandbox",            // setuid 샌드박스 비활성화
        "--disable-dev-shm-usage"              // 공유 메모리 사용 비활성화 (안정성 향상, 메모리 부족 문제 해결)
      ],
    });
  }

  /**
   * 사람인의 단일 채용 목록 페이지를 처리하는 메서드
   * 한 페이지에 있는 여러 채용공고 링크를 찾고 각각의 상세 정보를 추출합니다.
   * 
   * @param page - Puppeteer 페이지 객체 (브라우저의 탭을 나타냄)
   * @param pageNum - 처리할 페이지 번호 (예: 1, 2, 3...)
   * @param waitTime - 페이지 로딩 후 대기 시간 (밀리초)
   * @returns - 페이지에서 수집된 채용정보 배열
   * 
   * private: 클래스 내부에서만 호출 가능 (외부에서 직접 호출 불가)
   */
  private async processSaraminPage(page: Page, pageNum: number, waitTime: number): Promise<JobInfo[]> {
    // 현재 페이지에서 수집된 채용정보를 저장할 배열
    const pageJobs: JobInfo[] = []; 
    
    try {
      // 채용 목록 페이지 URL 생성 및 페이지 이동
      const pageUrl = this.buildSaraminPageUrl(pageNum);
      // 페이지 이동 및 네트워크 요청이 완료될 때까지 대기
      // waitUntil: "networkidle2"는 더 이상 네트워크 연결이 없을 때까지(최소 500ms 동안 2개 이하의 연결만 있을 때) 대기하라는 의미
      // 페이지가 완전히 로드됨을 보장
      await page.goto(pageUrl, { waitUntil: "networkidle2" }); 
      await sleep(waitTime); // 추가 로딩을 위한 대기 시간 (자바스크립트 등이 실행될 시간 확보)

      // 페이지에서 채용 공고 링크들을 추출
      const links = await this.extractJobLinks(page);
      console.log(`페이지 ${pageNum}: ${links.length}개의 채용공고를 발견했습니다`);

      // 각 채용 공고 링크에 대해 처리
      // for...of 반복문: 배열의 각 요소를 순회합니다.
      // 예: links 배열이 ['/job/1', '/job/2']라면,
      // link는 첫 번째 반복에서 '/job/1', 두 번째 반복에서 '/job/2'가 됩니다.
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
    jobs.forEach(job => {I
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
