/**
 * 🚀 웹 스크래퍼 서비스 클래스
 * 
 * 📌 이 파일은 무엇인가요?
 * - 사람인 웹사이트에서 채용 정보를 자동으로 수집하는 프로그램입니다.
 * - 웹 브라우저를 자동으로 제어하여 여러 페이지의 채용공고를 수집하고 분석합니다.
 * - 수집된 채용정보는 데이터베이스에 저장됩니다.
 * 
 * 📚 주요 기능:
 * 1. 웹 브라우저 자동 실행 및 제어 (Puppeteer 사용)
 * 2. 사람인 웹사이트의 채용정보 페이지 접근 및 정보 추출
 * 3. 이미 수집된 채용공고인지 확인하여 중복 수집 방지
 * 4. 추출된 채용정보를 데이터베이스에 저장
 * 5. 수집 결과 요약 및 통계 제공
 * 
 * 💻 사용 방법:
 * - ScraperControlService 인스턴스를 생성하고 openSaramin() 메서드를 호출하면 스크래핑이 시작됩니다.
 *   (예시: const scraper = new ScraperControlService(); await scraper.openSaramin();)
 * - 시작 페이지, 종료 페이지, 헤드리스 모드, 대기 시간 등 다양한 설정을 제공할 수 있습니다.
 *   (예시: await scraper.openSaramin({ startPage: 1, endPage: 5, headless: true });)
 * 
 * ✨ 초보자를 위한 팁:
 * - 클래스: 관련 기능들을 묶어놓은 '설계도'입니다. 붕어빵 틀로 생각하면 됩니다.
 * - 인터페이스: 객체가 가져야 할 속성과 타입을 정의한 '명세서'입니다. 설계 도면이라고 생각하세요.
 * - 비동기(async/await): 시간이 걸리는 작업을 기다리는 동안 프로그램이 멈추지 않게 해주는 기술입니다.
 *   (예: 웹페이지를 로딩하는 동안 다른 작업을 할 수 있게 해줍니다)
 */

// 필요한 외부 라이브러리들을 가져옵니다.
// import 구문: 다른 파일이나 라이브러리의 기능을 현재 파일에서 사용하기 위해 가져오는 문법입니다.
// 마치 요리에 필요한 재료를 준비하는 과정이라고 생각하면 됩니다.
import moment from "moment";                                 // 날짜와 시간을 쉽게 다루는 라이브러리 (예: '2023-05-15'같은 날짜 계산)
import { ScraperServiceABC, sleep } from "@qillie/wheel-micro-service"; // 기본 스크래퍼 서비스와 대기 기능 (프로그램이 잠시 멈추게 하는 기능)
import _ from "lodash";                                      // 유틸리티 함수 모음 라이브러리 (배열, 객체 등을 쉽게 다루는 도구들)
import sequelize from "sequelize";                           // 데이터베이스 작업을 위한 ORM 라이브러리 (SQL 없이 데이터베이스 사용)
import axios from "axios";                                   // HTTP 요청을 보내기 위한 라이브러리 (웹페이지 내용을 가져오는 도구)
import puppeteer from "puppeteer";                           // 웹 브라우저 자동화 라이브러리 (로봇이 브라우저를 조작한다고 생각하세요)
import { Browser, Page } from "puppeteer";                   // 타입스크립트용 puppeteer 타입 정의 (컴퓨터가 이해할 수 있는 설명서)
import CompanyRecruitmentTable from "../../models/main/CompanyRecruitmentTable";

/**
 * 채용 공고 정보 인터페이스
 * 
 * 🔎 설명: 
 * - 스크랩한 채용 공고의 정보를 담는 구조를 정의합니다.
 * - 각 속성은 채용공고의 특정 정보(회사명, 제목 등)를 나타냅니다.
 * - 타입스크립트의 인터페이스는 코드가 일관된 형태로 작성되도록 도와주는 '설계도'와 같습니다.
 * 
 * 💡 인터페이스란? 
 * - 객체가 어떤 속성과 타입을 가져야 하는지 정의하는 '설계도'입니다.
 * - 실제 데이터는 포함하지 않고 구조만 정의합니다.
 * - 집을 짓기 전에 '이 집은 방이 3개, 화장실이 2개 필요해'라고 계획하는 것과 비슷합니다.
 * - TypeScript에서 코드의 안정성을 높이고 개발 중 오류를 줄이는 데 도움을 줍니다.
 * - 예를 들어, 회사명을 숫자로 입력하면 오류를 표시해 실수를 방지합니다.
 */
interface JobInfo {
  companyName: string;  // 회사명 (문자열 타입) - 예: "삼성전자", "네이버" 등
  jobTitle: string;     // 채용 제목 (문자열 타입) - 예: "웹 개발자 채용", "프론트엔드 신입 모집" 등
  jobLocation: string;  // 근무지 위치 (문자열 타입) - 예: "서울시 강남구", "경기도 성남시" 등
  jobType: string;      // 채용 형태 (문자열 타입) - 예: "신입", "경력 3년 이상", "인턴" 등
  jobSalary: string;    // 급여 정보 (문자열 타입) - 예: "3,000만원 이상", "회사 내규에 따름" 등
  deadline: string;     // 지원 마감일 (문자열 타입) - 예: "2023-12-31", "상시채용" 등
  url?: string;         // 원본 채용공고 URL (선택적 속성) - 예: "https://www.saramin.co.kr/job/12345"
                        // '?'는 이 속성이 없을 수도 있다는 의미입니다 (필수가 아닌 선택사항)
  companyType?: string; // 기업형태 (선택적 속성) - 예: "대기업", "중소기업", "스타트업" 등
}

/**
 * 스크래퍼 설정 인터페이스
 * 
 * 🔎 설명:
 * - 스크래퍼 동작을 제어하기 위한 설정값들을 정의합니다.
 * - 사용자가 스크래퍼의 동작 방식을 커스터마이즈할 수 있게 해줍니다.
 * - 예: 스크랩할 페이지 범위, 브라우저 표시 여부 등을 설정할 수 있습니다.
 * 
 * 💡 선택적 속성(?) 이란?
 * - 모든 속성에 ?가 붙은 것은 '선택적 속성'으로, 반드시 값을 제공하지 않아도 된다는 의미입니다.
 * - 예를 들어 { startPage: 1 }처럼 일부 속성만 설정할 수 있습니다.
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
 * 🔎 설명:
 * - 이 클래스는 사람인 웹사이트에서 채용공고를 자동으로 수집하는 모든 기능을 담고 있습니다.
 * - 웹 브라우저를 자동으로 제어하여 여러 페이지의 채용정보를 수집합니다.
 * - 이미 수집된 채용공고는 건너뛰어 효율적으로 스크래핑합니다.
 * 
 * 💡 클래스란? 
 * - 특정 객체를 생성하기 위한 템플릿이며, 속성(변수)와 메서드(함수)를 포함합니다.
 * - 비슷한 기능들을 하나로 묶어서 코드를 정리하고 재사용하기 쉽게 만듭니다.
 * 
 * 💡 extends ScraperServiceABC란? 
 * - ScraperServiceABC라는 기본 클래스의 기능을 상속받아 확장한다는 의미입니다.
 * - 상속이란 이미 만들어진 클래스의 기능을 그대로 물려받고 추가 기능을 더하는 개념입니다.
 * - 이를 통해 코드 중복을 줄이고 일관된 구조를 유지할 수 있습니다.
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
    endPage: 31,        // 기본 종료 페이지는 31페이지 (2~31페이지까지 스크랩)
    headless: false,    // 기본적으로 브라우저 UI 표시 (디버깅하기 쉽게)
    waitTime: Math.floor(Math.random() * 2001) + 4000    // 4~6초(4000~6000ms) 사이 랜덤 대기 시간
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
    // Existing code for configuration
    const startPage = config.startPage ?? this.defaultConfig.startPage ?? 2;
    const endPage = config.endPage ?? this.defaultConfig.endPage ?? 20;
    const headless = config.headless ?? this.defaultConfig.headless ?? false;
    const waitTime = config.waitTime ?? this.defaultConfig.waitTime ?? 2000;
    
    let browser: Browser | null = null;
    const collectedJobs: JobInfo[] = [];
    
    // Logging start message
    console.log(`\n🚀 사람인 채용정보 스크래핑 시작`);
    console.log(`📄 페이지 범위: ${startPage} ~ ${endPage} 페이지`);
    console.log(`⚙️ 설정: 헤드리스 모드=${headless}, 대기 시간=${waitTime}ms\n`);
  
    const startTime = Date.now();
    
    // Add a counter for duplicate URLs
    let consecutiveDuplicates = 0;
    let continueScrapping = true;
  
    try {
      browser = await this.initializeBrowser(headless);
      const page = await browser.newPage();
      page.setDefaultTimeout(30000);
  
      // Modify the loop to check the continueScrapping flag
      for (let i = startPage; i <= endPage && continueScrapping; i++) {
        console.log(`\n🔍 페이지 ${i} 스크래핑 시작...`);
        
        // Process page and check for duplicates
        const pageJobs = await this.processSaraminPage(page, i, waitTime, consecutiveDuplicates, continueScrapping);
        
        // Check if we should stop scraping due to duplicates
        if (!continueScrapping) {
          console.log(`\n⚠️ 연속적으로 중복된 채용공고가 발견되어 스크래핑을 중단합니다.`);
          break;
        }
        
        collectedJobs.push(...pageJobs);
        console.log(`✅ 페이지 ${i} 완료: ${pageJobs.length}개의 채용공고 추출`);
      }
      
      // Existing summary code
      this.printSummary(collectedJobs);
      
      const endTime = Date.now();
      const elapsedTime = (endTime - startTime) / 1000;
      console.log(`⏱️ 총 소요 시간: ${elapsedTime.toFixed(2)}초`);
      
      return collectedJobs;
    } catch (error) {
      console.error(`❌ 스크래핑 중 오류 발생:`, error);
      return collectedJobs;
    } finally {
      if (browser) {
        await browser.close();
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
  private async processSaraminPage(
    page: Page, 
    pageNum: number, 
    waitTime: number,
    consecutiveDuplicates: number,
    continueScrapping: boolean
  ): Promise<JobInfo[]> {
    const pageJobs: JobInfo[] = [];
    
    try {
      const pageUrl = this.buildSaraminPageUrl(pageNum);
      await page.goto(pageUrl, { waitUntil: "networkidle2" });
      await sleep(waitTime);
  
      // Extract job links
      const links = await this.extractJobLinks(page);
      console.log(`페이지 ${pageNum}: ${links.length}개의 채용공고를 발견했습니다`);
      
      // 중복 확인을 위해 모든 URL을 먼저 확인
      const urlsToCheck = links.map(link => `https://www.saramin.co.kr${link}`);
      
      // 데이터베이스에서 이미 존재하는 URL 목록 가져오기
      const existingUrls = await CompanyRecruitmentTable.findAll({
        attributes: ['job_url'],
        where: {
          job_url: {
            [sequelize.Op.in]: urlsToCheck
          }
        }
      }).then(results => results.map(result => result.getDataValue('job_url')));
      
      console.log(`${existingUrls.length}개의 중복된 채용공고가 발견되었습니다.`);
      
      // 중복 URL 개수 카운트
      let duplicatesInThisPage = existingUrls.length;
      
      // 모든 URL이 중복이고 페이지에 채용공고가 5개 이상이면 스크래핑 중단 고려
      if (duplicatesInThisPage >= 5 && duplicatesInThisPage === links.length) {
        console.log(`\n⚠️ 모든 채용공고(${duplicatesInThisPage}개)가 이미 수집된 상태입니다.`);
        consecutiveDuplicates++;
        
        if (consecutiveDuplicates >= 3) {
          console.log(`\n⚠️ 연속 ${consecutiveDuplicates}개 페이지에서 중복된 채용공고만 발견되었습니다.`);
          continueScrapping = false;
          return pageJobs;
        }
      } else {
        consecutiveDuplicates = 0;
      }
      
      // 새로운 채용공고만 처리
      for (const link of links) {
        try {
          const fullUrl = `https://www.saramin.co.kr${link}`;
          
          // 이미 수집된 URL인지 확인
          if (existingUrls.includes(fullUrl)) {
            console.log(`🔄 이미 수집된 채용공고입니다: ${fullUrl}`);
            continue; // 중복된 URL은 건너뛰기
          }
          
          // 새로운 공고만 처리
          waitTime = Math.floor(Math.random() * 2001) + 4000
          const jobInfo = await this.extractJobDetails(page, fullUrl, waitTime);
          
          if (jobInfo) {
            jobInfo.url = fullUrl;
            pageJobs.push(jobInfo);
          }
        } catch (error) {
          console.error(`채용공고 정보 추출 오류: ${error}`);
          continue;
        }
      }
      
    } catch (error) {
      console.error(`페이지 ${pageNum} 처리 중 오류 발생: ${error}`);
    }
    
    return pageJobs;
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
    return `https://www.saramin.co.kr/zf_user/jobs/list/domestic?page=${pageNum}&loc_mcd=101000%2C102000&cat_kewd=2248%2C82%2C83%2C107%2C108%2C109%2C116%2C106%2C105%2C2239%2C80%2C81&edu_none=y&edu_min=8&edu_max=12&search_optional_item=y&search_done=y&panel_count=y&preview=y&isAjaxRequest=0&page_count=50&sort=RL&type=domestic&is_param=1&isSearchResultEmpty=1&isSectionHome=0&searchParamCount=5#searchTitle`;
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
        
        /**
         * 기업정보 추출 함수
         * 회사 정보 페이지에서 기업형태 등의 정보를 추출
         * @returns - 기업형태 문자열
         */
        const extractCompanyType = (): string => {
          // 기업형태 정보 찾기
          const companyInfoArea = document.querySelector(".info_area");
          if (!companyInfoArea) return "";
          
          // 모든 dl 요소를 찾아서 기업형태가 포함된 요소 검색
          const dlElements = companyInfoArea.querySelectorAll("dl");
          for (const dl of Array.from(dlElements)) {
            const dt = dl.querySelector("dt");
            if (dt && dt.textContent && dt.textContent.trim() === "기업형태") {
              const dd = dl.querySelector("dd");
              // title 속성에서 전체 기업형태 정보 가져오기 (생략 없는 전체 텍스트)
              if (dd && dd.getAttribute("title")) {
                return dd.getAttribute("title") || "";
              }
              // title 속성이 없으면 내부 텍스트 사용
              else if (dd) {
                return dd.textContent?.trim() || "";
              }
              return "";
            }
          }
          return "";
        };
        
        // 모든 컬럼 정보 추출
        const columnInfo = extractInfoFromColumns();
        
        // 회사명 추출 (여러 선택자 시도 - 첫 번째로 발견되는 요소 사용)
        const companyName = getTextContent(".title_inner .company") || getTextContent(".company_name") || getTextContent(".corp_name");
        
        // 채용 제목 추출 (여러 선택자 시도 - 첫 번째로 발견되는 요소 사용)
        const jobTitle = getTextContent(".job_tit") || getTextContent("h1.tit_job");
        
        // 근무지 정보 추출 및 정리
        const jobLocation = columnInfo["근무지역"]?.replace(/지도/g, "").trim() || "";
        
        // 마감일 정보 추출 (여러 필드 시도)
        // 마감일 정보 추출 - 새로운 HTML 구조 대응
        let deadline = "";
        
        // 시간/날짜 정보를 담고 있는 info_period 클래스 확인
        const infoDeadline = wrapContainer.querySelector(".info_period");
        if (infoDeadline) {
          // 마감일(dt.end) 뒤에 오는 dd 요소 찾기
          const endDt = infoDeadline.querySelector("dt.end");
          if (endDt && endDt.textContent?.includes("마감일")) {
            // 마감일 dt 다음에 오는 dd 요소의 내용 가져오기
            const endDd = endDt.nextElementSibling;
            if (endDd && endDd.tagName.toLowerCase() === "dd") {
              deadline = endDd.textContent?.trim() || "";
            }
          }
        }
        
        // 급여 정보 추출 및 정리 (불필요한 부분 제거)
        let jobSalary = columnInfo["급여"] || columnInfo["급여조건"] || "";
        if (jobSalary) {
          // 상세보기나 최저임금 텍스트 이전 부분만 사용
          jobSalary = jobSalary
            .split("상세보기")[0]
            .split("최저임금")[0]
            .trim();
          
          // "(주 16시간)" 이후의 "근무형태" 및 기타 텍스트 제거
          const hourPattern = /\(주 \d+시간\)/;
          const match = jobSalary.match(hourPattern);
          if (match) {
            const index = jobSalary.indexOf(match[0]) + match[0].length;
            jobSalary = jobSalary.substring(0, index).trim();
          }
        }
        
        // 기업형태 정보 추출
        const companyType = extractCompanyType();
        
        // 추출한 정보를 객체로 구성하여 반환
        return {
          companyName,   // 회사명
          jobTitle,      // 채용 제목
          jobLocation,   // 근무지
          jobType: columnInfo["경력"] || columnInfo["경력조건"] || "", // 경력 조건
          jobSalary,     // 급여 정보
          deadline,      // 마감일
          companyType    // 기업형태
        };
      });

      // 추출된 정보가 있으면 콘솔에 출력하고 DB에 저장
      if (jobInfo) {
        // DB에 채용정보 저장 (scraped_at, is_applied 필드 추가)
        await CompanyRecruitmentTable.create({
          company_name: jobInfo.companyName,
          job_title: jobInfo.jobTitle,
          job_location: jobInfo.jobLocation,
          job_type: jobInfo.jobType,
          job_salary: jobInfo.jobSalary,
          deadline: jobInfo.deadline,
          job_url: url,
          company_type: jobInfo.companyType || "", // 기업형태 정보 저장
          scraped_at: new Date(), // 현재 시간으로 데이터 수집 일시 설정
          is_applied: false       // 초기 지원 여부는 false로 설정
        });

        console.log(`\n✅ 채용정보 추출 성공`);
        console.log(`------------------------------`);
        console.log(`🏢 회사명: ${jobInfo.companyName}`);
        console.log(`📝 채용제목: ${jobInfo.jobTitle}`);
        console.log(`📍 근무지역: ${jobInfo.jobLocation}`);
        console.log(`👨‍💼 경력조건: ${jobInfo.jobType}`);
        console.log(`💰 급여정보: ${jobInfo.jobSalary}`);
        console.log(`⏰ 마감일자: ${jobInfo.deadline}`);
        console.log(`🏭 기업형태: ${jobInfo.companyType || "정보 없음"}`);
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
