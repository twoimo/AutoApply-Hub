import moment from "moment";
import { ScraperServiceABC, sleep } from "@qillie/wheel-micro-service";
import _ from "lodash";
import sequelize from "sequelize";
import axios from "axios";
import puppeteer from "puppeteer";
import { Browser, Page } from "puppeteer";

/**
 * 채용 공고 정보 인터페이스
 * 스크랩한 채용 공고의 정보를 담는 구조
 */
interface JobInfo {
  companyName: string;  // 회사명
  jobTitle: string;     // 채용 제목
  jobLocation: string;  // 근무지 위치
  jobType: string;      // 채용 형태 (경력/신입 등)
  jobSalary: string;    // 급여 정보
  deadline: string;     // 지원 마감일
  url?: string;         // 원본 채용공고 URL
}

/**
 * 스크래퍼 설정 인터페이스
 * 스크래퍼 동작을 제어하기 위한 설정값
 */
interface ScraperConfig {
  startPage?: number;    // 시작 페이지 번호
  endPage?: number;      // 종료 페이지 번호
  headless?: boolean;    // 헤드리스 모드 여부 (브라우저 UI 표시 여부)
  waitTime?: number;     // 페이지 로딩 대기 시간(ms)
}

/**
 * @name 사람인 스크래퍼
 * @description 사람인 웹사이트의 채용정보를 스크래핑하는 서비스
 */
export default class ScraperControlService extends ScraperServiceABC {
  /**
   * 기본 스크래퍼 설정값
   * 별도 설정이 제공되지 않을 때 사용됨
   */
  private defaultConfig: ScraperConfig = {
    startPage: 2,       // 기본 시작 페이지는 2페이지
    endPage: 20,        // 기본 종료 페이지는 20페이지
    headless: false,    // 기본적으로 브라우저 UI 표시 (디버깅 용이)
    waitTime: 2000      // 기본 대기 시간은 2초 (2000ms)
  };

  /**
   * 사람인 웹사이트의 채용정보를 스크래핑하는 메소드
   * @method openSaramin
   * @description
   * - Puppeteer를 사용하여 브라우저를 실행하고 사람인 채용정보 페이지에 접속합니다
   * - 설정된 페이지 범위를 순차적으로 접근합니다
   * - 각 페이지에서 채용공고 항목을 수집합니다
   * - 각 채용공고의 상세 페이지 링크를 추출하고 해당 페이지로 이동하여 정보를 수집합니다
   * @param config 스크래퍼 설정 객체 (선택적)
   * @returns 수집된 채용정보 배열
   */
  public async openSaramin(config: ScraperConfig = {}): Promise<JobInfo[]> {
    // 기본 설정과 사용자 제공 설정을 병합하고 undefined 값에 대한 기본값 설정
    const startPage = config.startPage ?? this.defaultConfig.startPage ?? 2;
    const endPage = config.endPage ?? this.defaultConfig.endPage ?? 20;
    const headless = config.headless ?? this.defaultConfig.headless ?? false;
    const waitTime = config.waitTime ?? this.defaultConfig.waitTime ?? 2000;
    
    let browser: Browser | null = null;
    const collectedJobs: JobInfo[] = []; // 수집된 채용정보를 저장할 배열
    
    console.log(`\n🚀 사람인 채용정보 스크래핑 시작`);
    console.log(`📄 페이지 범위: ${startPage} ~ ${endPage} 페이지`);
    console.log(`⚙️ 설정: 헤드리스 모드=${headless}, 대기 시간=${waitTime}ms\n`);

    const startTime = Date.now();

    try {
      // 최적화된 설정으로 브라우저 초기화
      browser = await this.initializeBrowser(headless);
      const page = await browser.newPage();
      
      // 페이지 로딩 타임아웃 설정 (30초)
      page.setDefaultTimeout(30000);

      // 페이지 범위 내 각 페이지 처리
      for (let i = startPage; i <= endPage; i++) {
        console.log(`\n🔍 페이지 ${i} 스크래핑 시작...`);
        
        // 현재 페이지의 채용정보 처리 및 결과 저장
        const pageJobs = await this.processSaraminPage(page, i, waitTime);
        collectedJobs.push(...pageJobs);
        
        console.log(`✅ 페이지 ${i} 완료: ${pageJobs.length}개의 채용공고 추출`);
      }
      
      // 스크래핑 결과 요약 출력
      this.printSummary(collectedJobs);
      
      const endTime = Date.now();
      const elapsedTime = (endTime - startTime) / 1000; // 초 단위로 변환
      console.log(`⏱️ 총 소요 시간: ${elapsedTime.toFixed(2)}초`);
      
      return collectedJobs;
    } catch (error) {
      // 스크래핑 도중 오류 발생 시 로깅하고 지금까지 수집된 결과 반환
      console.error(`❌ 스크래핑 중 오류 발생:`, error);
      return collectedJobs;
    } finally {
      // 오류 발생 여부와 관계없이 브라우저 종료 (리소스 정리)
      if (browser) {
        await browser.close();
        console.log(`🏁 브라우저 종료 및 스크래핑 완료`);
      }
    }
  }

  /**
   * 최적화된 설정으로 브라우저 초기화
   * @param headless 헤드리스 모드 여부 (기본값: false)
   * @returns 초기화된 Puppeteer 브라우저 객체
   */
  private async initializeBrowser(headless: boolean = false): Promise<Browser> {
    return puppeteer.launch({
      headless,  // 헤드리스 모드 설정 (true: UI 없음, false: UI 표시)
      defaultViewport: null,  // 뷰포트 크기 자동 조정
      args: [
        "--disable-web-security",              // 웹 보안 비활성화 (CORS 우회)
        "--disable-features=IsolateOrigins,site-per-process",  // 사이트 격리 기능 비활성화
        "--allow-running-insecure-content",    // 안전하지 않은 컨텐츠 실행 허용
        "--no-sandbox",                        // 샌드박스 모드 비활성화 (성능 향상)
        "--disable-setuid-sandbox",            // setuid 샌드박스 비활성화
        "--disable-dev-shm-usage"              // 공유 메모리 사용 비활성화 (안정성 향상)
      ],
    });
  }

  /**
   * 사람인의 단일 채용 목록 페이지 처리
   * @param page Puppeteer 페이지 객체
   * @param pageNum 처리할 페이지 번호
   * @param waitTime 대기 시간 (밀리초)
   * @returns 페이지에서 수집된 채용정보 배열
   */
  private async processSaraminPage(page: Page, pageNum: number, waitTime: number): Promise<JobInfo[]> {
    const pageJobs: JobInfo[] = []; // 현재 페이지에서 수집된 채용정보 저장 배열
    
    try {
      // 채용 목록 페이지로 이동
      const pageUrl = this.buildSaraminPageUrl(pageNum);
      await page.goto(pageUrl, { waitUntil: "networkidle2" }); // 네트워크 요청이 완료될 때까지 대기
      await sleep(waitTime); // 추가 로딩을 위한 대기 시간

      // 페이지에서 채용 공고 링크 추출
      const links = await this.extractJobLinks(page);
      console.log(`페이지 ${pageNum}: ${links.length}개의 채용공고를 발견했습니다`);

      // 각 채용 공고 링크 처리
      for (const link of links) {
        try {
          // 전체 URL 구성 및 채용 상세 정보 추출
          const fullUrl = `https://www.saramin.co.kr${link}`;
          const jobInfo = await this.extractJobDetails(page, fullUrl, waitTime);
          
          // 유효한 채용정보인 경우 결과 배열에 추가
          if (jobInfo) {
            jobInfo.url = fullUrl; // 원본 URL 저장
            pageJobs.push(jobInfo);
          }
        } catch (error) {
          // 개별 채용공고 처리 중 오류 발생 시 로깅 후 계속 진행
          console.error(`채용공고 정보 추출 오류: ${error}`);
          continue; // 다음 링크로 진행
        }
      }
    } catch (error) {
      // 페이지 전체 처리 중 오류 발생 시 로깅
      console.error(`페이지 ${pageNum} 처리 중 오류 발생: ${error}`);
    }
    
    return pageJobs;
  }

  /**
   * 사람인 특정 페이지의 URL 생성
   * @param pageNum 페이지 번호
   * @returns 완성된 사람인 페이지 URL
   */
  private buildSaraminPageUrl(pageNum: number): string {
    // IT/개발 직군 채용정보로 필터링된 URL 생성
    return `https://www.saramin.co.kr/zf_user/jobs/list/domestic?page=${pageNum}&loc_mcd=101000%2C102000&cat_kewd=2248%2C82%2C83%2C107%2C108%2C109&search_optional_item=n&search_done=y&panel_count=y&preview=y&isAjaxRequest=0&page_count=50&sort=RL&type=domestic&is_param=1&isSearchResultEmpty=1&isSectionHome=0&searchParamCount=2#searchTitle`;
  }

  /**
   * 채용 목록 페이지에서 채용공고 링크 추출
   * @param page Puppeteer 페이지 객체
   * @returns 추출된 채용공고 링크 배열
   */
  private async extractJobLinks(page: Page): Promise<string[]> {
    // 페이지 내 자바스크립트 실행을 통해 링크 추출
    return page.evaluate(() => {
      const linkList: string[] = [];
      // 채용공고 항목 선택 (.box_item 클래스를 가진 요소들)
      const boxItems = document.querySelectorAll(".box_item");

      // 각 채용공고 항목에서 링크 추출
      boxItems.forEach((item) => {
        // 채용정보가 있는 컨테이너 선택
        const notificationInfo = item.querySelector(".notification_info");
        if (notificationInfo) {
          // 링크 요소 찾기 및 href 속성 추출
          const linkElement = notificationInfo.querySelector("a");
          if (linkElement && linkElement.getAttribute("href")) {
            linkList.push(linkElement.getAttribute("href") || "");
          }
        }
      });

      return linkList; // 수집된 링크 배열 반환
    });
  }

  /**
   * 채용공고 상세 페이지에서 세부 정보 추출
   * @param page Puppeteer 페이지 객체
   * @param url 채용공고 상세 페이지 URL
   * @param waitTime 대기 시간 (밀리초)
   * @returns 추출된 채용정보 객체 또는 실패 시 null
   */
  private async extractJobDetails(page: Page, url: string, waitTime: number): Promise<JobInfo | null> {
    try {
      // 처리 중인 URL 로깅 (디버깅 용도)
      console.log(`\n=============================`);
      console.log(`🔍 채용공고 상세 페이지 처리 시작: ${url}`);
      console.log(`=============================`);
      
      // 상세 페이지로 이동 및 로딩 대기
      await page.goto(url, { waitUntil: "networkidle2" });
      await sleep(waitTime);

      // 페이지 내 자바스크립트 실행하여 채용정보 추출
      const jobInfo = await page.evaluate(() => {
        // 채용정보 컨테이너 찾기
        const wrapContainer = document.querySelector(".wrap_jv_cont");
        if (!wrapContainer) return null; // 컨테이너가 없으면 null 반환

        /**
         * 선택자에서 텍스트 내용 추출 도우미 함수
         * @param selector CSS 선택자
         * @returns 추출된 텍스트 (없으면 빈 문자열)
         */
        const getTextContent = (selector: string): string => {
          const element = wrapContainer.querySelector(selector);
          return element ? element.textContent?.trim() || "" : "";
        };

        /**
         * 마감일 정보 추출 도우미 함수
         * 여러 방식으로 날짜 정보를 찾아 추출
         * @returns 추출된 마감일 문자열 (없으면 빈 문자열)
         */
        const extractDeadline = (): string => {
          // 마감일 관련 키워드가 포함된 텍스트 찾기
          const allElements = Array.from(wrapContainer.querySelectorAll("*"));
          for (const el of allElements) {
            const text = el.textContent || "";
            if (text.includes("마감일") || text.includes("접수기간") || 
                text.includes("모집기간") || text.includes("공고기간")) {
              // 날짜 패턴 찾기 (예: 2023-01-31, 2023.01.31)
              const datePattern = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/g;
              // 시간 패턴 찾기 (예: 13:00)
              const timePattern = /\d{1,2}:\d{2}/g;
              
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
          return "";
        };

        /**
         * DL/DT/DD 구조에서 정보 추출 도우미 함수
         * 제목(dt)과 값(dd)의 쌍으로 구성된 정보 추출
         * @returns 추출된 정보 객체
         */
        const extractInfoFromColumns = (): Record<string, string> => {
          const result: Record<string, string> = {};
          const dlElements = wrapContainer.querySelectorAll("dl");
          
          // 각 정의 리스트에서 제목과 값을 추출하여 객체로 변환
          dlElements.forEach((dl) => {
            const title = dl.querySelector("dt")?.textContent?.trim() || "";
            const value = dl.querySelector("dd")?.textContent?.trim() || "";
            if (title && value) result[title] = value;
          });
          
          return result;
        };
        
        // 모든 컬럼 정보 추출
        const columnInfo = extractInfoFromColumns();
        
        // 회사명 추출 (여러 선택자 시도)
        const companyName = getTextContent(".company_name") || getTextContent(".corp_name");
        
        // 채용 제목 추출 (여러 선택자 시도)
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
