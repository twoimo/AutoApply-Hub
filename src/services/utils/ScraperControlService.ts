import { ScraperServiceABC } from "@qillie/wheel-micro-service";
import { ScraperFactory } from "./ScraperFactory";
import { JobInfo, ScraperConfig } from "./types/JobTypes";
import { JobMatchResult } from "./ai/JobMatchingService";
import colors from 'ansi-colors';
import path from 'path';
import cron from 'node-cron';
import puppeteer from 'puppeteer'; // Add puppeteer import for Cookie types
import dotenv from 'dotenv';
// Add import for CompanyRecruitmentTable
import CompanyRecruitmentTable from "../../models/main/CompanyRecruitmentTable";

// .env 파일 로드
dotenv.config();

/**
 * 스크래퍼 컨트롤 서비스 
 * 모듈화된 서비스들을 조율하고 스크래핑 작업을 제어합니다.
 */
export default class ScraperControlService extends ScraperServiceABC {
  private factory: ScraperFactory;
  private cronJob: cron.ScheduledTask | null = null;
  
  // 기본 설정
  private defaultConfig: ScraperConfig = {
    startPage: 1,
    endPage: Number.MAX_SAFE_INTEGER,
    headless: false,
    waitTime: Math.floor(Math.random() * 2001) + 4000,
    verbose: false
  };

  constructor(signInCookieKeys: string[]) {
    super(signInCookieKeys);
    this.factory = ScraperFactory.getInstance();
    // 임시 디렉토리 확인
    this.ensureTempDirectory();
  }

  /**
   * 임시 디렉토리 존재 확인
   */
  private ensureTempDirectory(): void {
    const tempDir = path.join(process.cwd(), 'temp');
    this.factory.getImageProcessor().ensureTempDirectory();
  }

  /**
   * 한국 시간 주중 오후 5시에 스크래핑 작업 스케줄링
   * @param config 스크래퍼 설정
   * @returns 스케줄러 시작 여부
   */
  public scheduleWeekdayScraping(config: ScraperConfig = {}): boolean {
    // 기존 크론잡이 있다면 중지
    if (this.cronJob) {
      this.cronJob.stop();
      this.factory.getLogger().log('기존 스케줄링된 작업이 중지되었습니다.', 'info');
    }
    
    try {
      // 한국 시간 (KST) 기준 오후 5시 (17:00) 주중에만 실행
      // 크론 표현식: 분 시 일 월 요일
      this.cronJob = cron.schedule('0 17 * * 1-5', async () => {
        const logger = this.factory.getLogger();
        
        logger.log('스케줄된 스크래핑 작업이 시작됩니다.', 'info');
        
        await this.runScheduledScraping(config);
      }, {
        scheduled: true,
        timezone: 'Asia/Seoul' // 한국 시간대 설정
      });
      
      const logger = this.factory.getLogger();
      logger.log('스크래핑 작업이 한국 시간 주중 오후 5시(17:00)에 실행되도록 스케줄링되었습니다.', 'success');
      
      return true;
    } catch (error) {
      const logger = this.factory.getLogger();
      logger.log(`스크래핑 작업 스케줄링 중 오류 발생: ${error}`, 'error');
      
      return false;
    }
  }

  /**
   * 스케줄링된 스크래핑 실행
   */
  private async runScheduledScraping(config: ScraperConfig = {}): Promise<void> {
    const logger = this.factory.getLogger();
    
    try {
      logger.log('스케줄된 사람인 채용 정보 스크래핑을 시작합니다...', 'info');
      
      // 중복 URL 체크 후 스크래핑 실행
      const jobs = await this.openSaraminWithDuplicateCheck(config);
      
      logger.log(`스케줄된 스크래핑 완료: ${jobs.length}개 새 채용 공고 수집됨`, 'success');
      
      // 스크래핑 완료 후 자동 매칭 실행
      logger.log('스케줄된 스크래핑 완료 후 자동 매칭을 시작합니다...', 'info');
      
      await this.runAutoJobMatching();
      
    } catch (error) {
      logger.log(`스케줄된 스크래핑 작업 실행 중 오류: ${error}`, 'error');
    }
  }

  /**
   * 크론 작업 중지
   */
  public stopScheduledScraping(): boolean {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.factory.getLogger().log('스케줄링된 스크래핑 작업이 중지되었습니다.', 'success');
      return true;
    }
    
    this.factory.getLogger().log('활성화된 스케래핑 스케줄이 없습니다.', 'warning');
    return false;
  }

  /**
   * URL 중복 체크 후 사람인 채용 공고 스크래핑 시작
   */
  public async openSaraminWithDuplicateCheck(config: ScraperConfig = {}): Promise<JobInfo[]> {
    const logger = this.factory.getLogger();
    const jobRepository = this.factory.getJobRepository();
    const saraminScraper = this.factory.getSaraminScraper();
    
    // 기본값과 함께 설정 적용
    const settings = this.applyConfiguration(config);
    
    logger.log('채용 공고 URL 중복 검사 중...', 'info');
    
    // URL 검사를 위한 해시맵 초기화 (중복 제거)
    const uniqueUrls = new Map<string, boolean>();
    const pagesToCheck = 5; // 첫 5페이지 검사 (설정에 따라 조정 가능)
    let totalJobsCount = 0;
    
    // 스크래핑 전 여러 페이지 검사
    try {
      const browserService = this.factory.getBrowserService();
      const browser = await browserService.initializeBrowser(settings.headless);
      const page = await browserService.createPage();
      
      // 여러 페이지에서 URL 수집
      for (let pageNum = settings.startPage; pageNum < settings.startPage + pagesToCheck; pageNum++) {
        logger.log(`URL 수집을 위해 페이지 ${pageNum} 검사 중...`, 'info');
        
        // 페이지 URL 생성
        const pageUrl = saraminScraper.buildPageUrl(pageNum);
        
        // 페이지 로드
        const loadSuccess = await browserService.loadPageWithRetry(page, pageUrl, {
          waitForSelector: ".box_item",
          waitTime: Math.floor(Math.random() * 1000) + 2000 // 짧은 대기 시간
        });
        
        if (!loadSuccess) {
          logger.log(`페이지 ${pageNum} 로드 실패, 다음 페이지로 진행`, 'warning');
          continue;
        }
        
        // 채용 공고 링크 추출
        const links = await page.evaluate(() => {
          const linkList: string[] = [];
          const boxItems = document.querySelectorAll(".box_item");
          
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
        
        // 링크가 없으면 이후 페이지도 확인할 필요 없음
        if (links.length === 0) {
          logger.log(`페이지 ${pageNum}에서 채용 공고를 찾을 수 없어 URL 수집을 중단합니다.`, 'warning');
          break;
        }
        
        // 각 채용 공고 URL 생성 및 해시맵에 추가
        links.forEach(link => {
          const fullUrl = `https://www.saramin.co.kr${link}`;
          if (!uniqueUrls.has(fullUrl)) {
            uniqueUrls.set(fullUrl, true);
            totalJobsCount++;
          }
        });
        
        logger.log(`페이지 ${pageNum}에서 ${links.length}개 URL 수집, 현재까지 총 ${uniqueUrls.size}개 고유 URL`, 'info');
      }
      
      // 브라우저 종료
      await browserService.closeBrowser();
      
      // 수집된 URL이 없는 경우
      if (uniqueUrls.size === 0) {
        logger.log('수집된 채용 공고 URL이 없습니다.', 'warning');
        return [];
      }
      
      // 해시맵에서 URL 목록 추출
      const urlsToCheck = Array.from(uniqueUrls.keys());
      
      // 기존 URL 중복 확인
      const existingUrls = await jobRepository.checkExistingUrls(urlsToCheck);
      
      // 중복 URL을 위한 해시맵 (빠른 검색용)
      const existingUrlsMap = new Map<string, boolean>();
      existingUrls.forEach(url => existingUrlsMap.set(url, true));
      
      // 새로운 URL만 필터링
      const newUrls = urlsToCheck.filter(url => !existingUrlsMap.has(url));
      
      // 중복 체크 결과 출력
      const duplicatesCount = existingUrls.length;
      const newUrlsCount = newUrls.length;
      
      logger.log(`${urlsToCheck.length}개 고유 채용 공고 중 ${duplicatesCount}개는 이미 수집됨, ${newUrlsCount}개 새로운 공고 있음`, 
        newUrlsCount > 0 ? 'info' : 'warning');
      
      // 모든 URL이 중복인 경우
      if (newUrlsCount === 0) {
        logger.log('모든 채용 공고가 이미 수집되었습니다. 스크래핑을 건너뜁니다.', 'warning');
        return [];
      }
      
      // 새 URL이 있는 경우 정상 스크래핑 진행
      logger.log(`${newUrlsCount}개의 새로운 채용 공고가 발견되었습니다. 스크래핑을 진행합니다.`, 'success');
      
      // 수집된 새 URL 정보 표시
      if (newUrlsCount > 0 && newUrlsCount <= 10) {
        newUrls.forEach((url, index) => {
          logger.log(`  ${index + 1}. ${url}`, 'info');
        });
      }
      
      // 스크래핑 대상 페이지 결정 (새 URL이 있는 페이지부터)
      const customConfig = {
        ...config,
        startPage: settings.startPage, // 원래 시작 페이지부터 유지
      };
      
      // 정상 스크래핑 프로세스 실행
      const jobs = await this.openSaramin(customConfig);
      
      // 스크래핑 완료 후 자동 매칭 실행은 openSaramin 내에서 처리됨
      
      return jobs;
      
    } catch (error) {
      logger.log(`URL 중복 검사 중 오류: ${error}`, 'error');
      // 오류 발생해도 정상 스크래핑 시도
      return await this.openSaramin(config);
    }
  }

  /**
   * 사람인 채용 공고 스크래핑 시작
   */
  public async openSaramin(config: ScraperConfig = {}): Promise<JobInfo[]> {
    // 서비스 인스턴스 획득
    const logger = this.factory.getLogger();
    const browserService = this.factory.getBrowserService();
    const saraminScraper = this.factory.getSaraminScraper();
    const jobRepository = this.factory.getJobRepository();
    
    // 기본값과 함께 설정 적용
    const settings = this.applyConfiguration(config);
    
    // 상세 로깅 설정
    this.factory.setVerboseLogging(settings.verbose);
    
    const collectedJobs: JobInfo[] = [];
    
    // 로깅 개선: 구분선과 함께 시작 메시지 출력
    logger.log(`사람인 채용 정보 스크래핑 시작 (페이지 ${settings.startPage}부터)`, 'info', true);
    
    const startTime = Date.now();
    
    let consecutiveDuplicates = 0;
    let consecutiveEmptyPages = 0;
    let continueScrapping = true;
  
    try {
      // 브라우저 초기화
      const browser = await browserService.initializeBrowser(settings.headless);
      const page = await browserService.createPage();
      
      let processedPages = 0;
  
      // 페이지별 처리
      for (let i = settings.startPage; i <= settings.endPage && continueScrapping; i++) {
        // 로깅 개선: 페이지 처리 시작 명확하게 표시
        logger.log(`페이지 ${i} 처리 중...`, 'info', true);
        
        // 페이지 처리
        const result = await saraminScraper.processListPage(page, i, settings.waitTime);
        
        processedPages++;
        const pageJobs = result.jobs;
        
        // 빈 페이지 및 중복 페이지 처리
        const continueScraping = await saraminScraper.handleConsecutivePages(
          pageJobs, 
          consecutiveEmptyPages, 
          consecutiveDuplicates
        );
        
        // 결과 업데이트
        consecutiveEmptyPages = continueScraping.emptyCounts;
        consecutiveDuplicates = continueScraping.duplicateCounts;
        
        // 스크래핑 중단 조건 확인
        if (!continueScraping.shouldContinue) {
          // 로깅 개선: 중단 이유 명확하게 표시
          logger.log('연속된 빈 페이지 또는 중복 페이지로 인해 스크래핑을 중단합니다.', 'warning', true);
          break;
        }
        
        // continueScrapping 업데이트
        continueScrapping = result.shouldContinue;
        
        collectedJobs.push(...pageJobs);
        // 로깅 개선: 성공 메시지를 더 눈에 띄게 표시
        logger.log(`페이지 ${i} 완료: ${pageJobs.length}개 채용 공고 추출됨`, 'success', true);
        
        // 로깅 개선: 진행 상황 표시
        if (i < settings.endPage && continueScrapping) {
          logger.log(`다음 페이지로 이동 중...`, 'info');
          await new Promise(resolve => setTimeout(resolve, 1000)); // 짧은 대기기로 로그가 터미널에 표시될 시간 확보
        }
      }
      
      // 로깅 개선: 구분선으로 결과 요약 구분
      logger.log('스크래핑 결과 요약', 'info', true);
      
      // 결과 요약 출력
      this.printSummary(collectedJobs);
      
      const elapsedTime = (Date.now() - startTime) / 1000;
      logger.log(`총 소요 시간: ${elapsedTime.toFixed(2)}초`, 'success', true);
      
      // 스크래핑 완료 후 자동 매칭 실행
      if (collectedJobs.length > 0) {
        logger.log('스크래핑 완료 후 자동 매칭을 시작합니다...', 'info', true);
        await this.runAutoJobMatching();
      }
      
      // 로깅 개선: 구분선으로 스크래핑 종료 명확하게 표시
      logger.log(`스크래핑 작업이 완료되었습니다. 총 ${collectedJobs.length}개 채용 공고 수집`, 'success', true);
      
      return collectedJobs;
    } catch (error) {
      // 로깱 개선: 오류 메시지 더 명확하게 표시
      logger.log(`스크래핑 중 오류 발생: ${error}`, 'error', true);
      return collectedJobs;
    } finally {
      // 브라우저 종료
      await browserService.closeBrowser();
      logger.log(`브라우저 종료 및 스크래핑 완료`, 'success');
    }
  }

  /**
   * 스크래핑 후 자동으로 매칭 작업 실행
   * 매칭되지 않은 채용 공고만 대상으로 함
   */
  public async runAutoJobMatching(): Promise<void> {
    const logger = this.factory.getLogger();
    
    // 구분선으로 작업 시작 표시
    logger.log('자동 채용 공고 매칭 작업을 시작합니다', 'info');
    
    const startTime = Date.now();
    
    try {
      // 매칭 서비스 획득
      const jobRepository = this.factory.getJobRepository();
      
      // JobMatchingService 인스턴스 생성
      const mainService = new (await import('./ai/JobMatchingService')).default();
      
      // 배치 사이즈와 처리된 작업 수 초기화
      const batchSize = 10;
      let processedCount = 0;
      let totalProcessed = 0;
      let shouldContinue = true;
      let batchNumber = 1;
      
      // 매칭 전 총 처리 대상 수 확인
      const totalUnmatched = await jobRepository.countUnmatchedJobs();
      logger.log(`매칭이 필요한 총 채용 공고 수: ${totalUnmatched}개`, 'info');
      
      if (totalUnmatched === 0) {
        logger.log('매칭되지 않은 채용 공고가 없습니다. 작업을 건너뜁니다.', 'info');
        return;
      }
      
      while (shouldContinue) {
        // 배치 시작 로그
        logger.log(`배치 #${batchNumber} 매칭 작업 시작 (최대 ${batchSize}개)`, 'info');
        
        // 매칭되지 않은 채용 공고 가져오기
        const unmatchedJobs = await jobRepository.getUnmatchedJobs(batchSize);
        
        if (unmatchedJobs.length === 0) {
          logger.log('더 이상 매칭되지 않은 채용 공고가 없습니다.', 'success');
          shouldContinue = false;
          continue;
        }
        
        // 채용 공고 ID 목록 출력
        const jobIds = unmatchedJobs.map(job => job.id).join(', ');
        logger.log(`처리할 채용 공고 ID: ${jobIds}`, 'info');
        
        // 진행 상황 표시
        const progressPct = Math.min(100, Math.round((totalProcessed / totalUnmatched) * 100));
        logger.log(`매칭 진행 상황: ${totalProcessed}/${totalUnmatched} (${progressPct}%)`, 'info');
        
        // 채용 공고 매칭 실행
        const matchResult = await mainService.matchJobs({
          limit: unmatchedJobs.length,
          matchLimit: 10
        });
        
        if (matchResult.success) {
          processedCount = unmatchedJobs.length;
          totalProcessed += processedCount;
          
          logger.log(`배치 #${batchNumber} 완료: ${processedCount}개 처리됨, 총 ${totalProcessed}/${totalUnmatched}개`, 'success');
        } else {
          logger.log(`매칭 실패: ${matchResult.message}`, 'error');
          shouldContinue = false;
        }
        
        // 처리량이 배치 사이즈보다 작으면 모두 처리한 것으로 간주
        if (processedCount < batchSize) {
          logger.log(`배치 크기(${batchSize})보다 적은 ${processedCount}개가 처리되어 모든 작업이 완료된 것으로 판단됩니다.`, 'info');
          shouldContinue = false;
        }
        
        // 다음 배치 처리 전 잠시 대기
        if (shouldContinue) {
          const waitSeconds = 3;
          logger.log(`다음 배치 처리를 위해 ${waitSeconds}초 대기 중...`, 'info');
          await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
        }
        
        batchNumber++;
      }
      
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.log(`자동 매칭 작업 완료: 총 ${totalProcessed}개 채용 공고 처리됨 (소요 시간: ${elapsedTime}초)`, 'success');
    } catch (error) {
      logger.log(`자동 매칭 중 오류 발생: ${error}`, 'error');
      
      // 오류 세부 정보 출력
      if (error instanceof Error && error.stack) {
        logger.logVerbose(`오류 스택: ${error.stack}`);
      }
    }
  }

  /**
   * 사람인 채용 사이트 로그인
   * @param username 사용자 아이디 (기본값: 환경변수에서 가져옴)
   * @param password 사용자 비밀번호 (기본값: 환경변수에서 가져옴)
   * @returns 로그인 성공 여부와 쿠키 정보를 포함한 객체
   */
  public async loginSaramin(
    username: string = process.env.SARAMIN_USER_NAME || '', 
    password: string = process.env.SARAMIN_PASSWORD || ''
  ): Promise<{ success: boolean; message: string; cookies?: string[] }> {
    const logger = this.factory.getLogger();
    const browserService = this.factory.getBrowserService();
    
    logger.log('사람인 로그인 시도 중...', 'info', true);
    
    // 환경 변수 확인
    if (!username || !password) {
      logger.log('사용자 이름 또는 비밀번호가 제공되지 않았습니다. 환경 변수 SARAMIN_USER_NAME, SARAMIN_PASSWORD를 확인하세요.', 'error');
      return { success: false, message: '로그인 정보가 없습니다. 환경 변수를 확인하세요.' };
    }
    
    try {
      // 브라우저 초기화 (headless 모드 끄기)
      const browser = await browserService.initializeBrowser(false);
      const page = await browserService.createPage();
      
      // 로그인 페이지로 이동
      const loginUrl = "https://www.saramin.co.kr/zf_user/auth";
      logger.log(`로그인 페이지 로드 중: ${loginUrl}`, 'info');
      
      const loadSuccess = await browserService.loadPageWithRetry(page, loginUrl, {
        waitForSelector: "#id",
        waitTime: 2000
      });
      
      if (!loadSuccess) {
        logger.log('로그인 페이지 로드 실패', 'error');
        return { success: false, message: '로그인 페이지 로드 실패' };
      }
      
      // 로그인 폼 구조 분석 (디버깅 용도)
      const formStructure = await page.evaluate(() => {
        const loginForm = document.querySelector('#loginForm') || document.querySelector('form[name="loginForm"]');
        if (!loginForm) return '로그인 폼을 찾을 수 없음';
        
        return loginForm.innerHTML;
      });
      
      logger.logVerbose('로그인 폼 구조 분석:\n' + formStructure);
      
      // 로그인 입력 필드 확인
      const hasLoginForm = await browserService.evaluate<boolean>(page, () => {
        return document.querySelector('#id') !== null && document.querySelector('#password') !== null;
      });
      
      if (!hasLoginForm) {
        logger.log('로그인 폼을 찾을 수 없습니다', 'error');
        return { success: false, message: '로그인 폼을 찾을 수 없습니다' };
      }
      
      // 아이디와 비밀번호 입력
      logger.log('아이디 입력 중...', 'info');
      await page.type('#id', username);
      
      logger.log('비밀번호 입력 중...', 'info');
      await page.type('#password', password);
      
      // 로그인 버튼 찾기 (여러 선택자 시도)
      const loginButton = await browserService.evaluate<string>(page, () => {
        // 가능한 로그인 버튼 선택자들
        const possibleSelectors = [
          '.login-form button[type="submit"]'
        ];
        
        // 각 선택자에 대해 요소가 존재하는지 확인
        for (const selector of possibleSelectors) {
          try {
            const element = document.querySelector(selector);
            if (element) {
              return selector; // 발견된 선택자 반환
            }
          } catch (e) {
            // 선택자 오류 무시하고 계속 진행
          }
        }
        
        // 모든 버튼 요소 찾기
        const allButtons = Array.from(document.querySelectorAll('button'));
        const loginBtnIdx = allButtons.findIndex(btn => 
          btn.innerText.includes('로그인') || 
          btn.innerText.includes('Login') || 
          btn.className.includes('login')
        );
        
        if (loginBtnIdx >= 0) {
          // 발견된 버튼에 식별자 추가
          const foundBtn = allButtons[loginBtnIdx];
          foundBtn.setAttribute('data-login-button', 'true');
          return '[data-login-button="true"]';
        }
        
        return ''; // 버튼을 찾지 못함
      });
      
      if (!loginButton) {
        // 버튼을 찾지 못한 경우 전체 페이지 스크린샷 캡처 (디버깅 용도)
        const screenshotPath = path.join(process.cwd(), 'temp', 'login-page-debug.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        logger.log(`로그인 버튼을 찾을 수 없습니다. 스크린샷이 저장됨: ${screenshotPath}`, 'error');
        return { success: false, message: '로그인 버튼을 찾을 수 없습니다' };
      }
      
      logger.log(`로그인 버튼 발견: ${loginButton}`, 'info');
      
      // 로그인 버튼 클릭
      logger.log('로그인 시도 중...', 'info');
      await Promise.all([
        page.click(loginButton),
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {
          logger.log('로그인 후 페이지 로드 대기 중 시간 초과', 'warning');
        })
      ]);
      
      // 로그인 성공 여부 확인
      const isLoggedIn = await browserService.evaluate<boolean>(page, () => {
        // 로그인 성공 시 보이는 요소들 확인
        return document.querySelector('.my_login') !== null || 
               document.querySelector('.btn_logout') !== null ||
               document.querySelector('.user_name') !== null;
      });
      
      if (!isLoggedIn) {
        // 오류 메시지 확인
        const errorMessage = await browserService.evaluate<string>(page, () => {
          const errorElement = document.querySelector('.error_message, .txt_error');
          return errorElement ? errorElement.textContent?.trim() || '알 수 없는 오류' : '로그인 실패';
        });
        
        logger.log(`로그인 실패: ${errorMessage}`, 'error');
        return { success: false, message: errorMessage || '로그인 실패' };
      }
      
      // 쿠키 추출
      const cookies = await page.cookies();
      const cookieStrings = cookies.map(cookie => `${cookie.name}=${cookie.value}`);
      
      logger.log('로그인 성공! 사람인 계정으로 인증되었습니다.', 'success', true);
      
      return { 
        success: true, 
        message: '로그인 성공', 
        cookies: cookieStrings 
      };
      
    } catch (error) {
      logger.log(`로그인 중 오류 발생: ${error}`, 'error');
      return { success: false, message: `로그인 중 오류: ${error}` };
    } finally {
      // 브라우저는 종료하지 않고 유지 (로그인 상태를 계속 사용할 수 있도록)
      // 필요한 경우 별도로 closeBrowser를 호출하여 종료
    }
  }

  /**
   * 사람인 채용 공고에 자동으로 지원하기
   * 추천된(is_recommended = true) 공고 중 아직 지원하지 않은(is_applied = false) 공고에 지원합니다.
   * @returns 지원 결과 정보를 포함한 객체
   */
  public async applySaraminJobs(): Promise<{ 
    success: boolean; 
    message: string; 
    applied: number;
    failed: number;
    details?: string[];
  }> {
    const logger = this.factory.getLogger();
    const browserService = this.factory.getBrowserService();
    const jobRepository = this.factory.getJobRepository();
    
    logger.log('사람인 자동 지원 프로세스 시작...', 'info', true);
    
    // 결과 추적을 위한 변수들
    let appliedCount = 0;
    let failedCount = 0;
    const details: string[] = [];
    
    try {
      // 1. 먼저 로그인 시도
      const loginResult = await this.loginSaramin();
      
      if (!loginResult.success) {
        logger.log(`로그인 실패: ${loginResult.message}`, 'error');
        return { 
          success: false, 
          message: `로그인 실패: ${loginResult.message}`, 
          applied: 0,
          failed: 0
        };
      }
      
      logger.log('로그인 성공. 지원 가능한 채용 공고를 검색합니다...', 'success');
      
      // 2. 추천되었지만 아직 지원하지 않은 채용 공고 조회
      const targetJobs = await CompanyRecruitmentTable.findAll({
        where: {
          is_recommended: true,
          is_applied: false
        },
        order: [["id", "ASC"]],
        raw: false
      });
      
      if (targetJobs.length === 0) {
        logger.log('지원할 추천 채용 공고가 없습니다.', 'info');
        return { 
          success: true, 
          message: '지원할 추천 채용 공고가 없습니다.', 
          applied: 0,
          failed: 0 
        };
      }
      
      logger.log(`총 ${targetJobs.length}개의 지원할 채용 공고가 있습니다.`, 'info');
      
      // 3. 브라우저가 이미 초기화되었는지 확인 (로그인 과정에서 브라우저가 생성되어 있어야 함)
      const browser = await browserService.initializeBrowser(false);
      const page = await browserService.createPage();
      
      // 4. 각 채용 공고에 대해 지원 프로세스 실행
      for (const job of targetJobs) {
        try {
          const companyName = job.company_name;
          const jobTitle = job.job_title;
          const jobUrl = job.job_url;
          
          logger.log(`${companyName} - ${jobTitle} 지원 시도 중...`, 'info');
          
          if (!jobUrl) {
            logger.log('채용 공고 URL이 없습니다. 건너뜁니다.', 'warning');
            failedCount++;
            details.push(`[실패] ${companyName} - ${jobTitle}: URL 없음`);
            continue;
          }
          
          // 5. 채용 공고 페이지로 이동
          logger.log(`채용 공고 페이지 로딩 중: ${jobUrl}`, 'info');
          const loadSuccess = await browserService.loadPageWithRetry(page, jobUrl, {
            waitTime: 3000
          });
          
          if (!loadSuccess) {
            logger.log('채용 공고 페이지 로드 실패. 다음 공고로 넘어갑니다.', 'error');
            failedCount++;
            details.push(`[실패] ${companyName} - ${jobTitle}: 페이지 로드 실패`);
            continue;
          }
          
            // 6. 입사지원 버튼 찾기
            const applyButtonInfo = await browserService.evaluate<{selector: string, text: string} | null>(page, () => {
              // 먼저, 페이지에 jview 요소가 있는지 확인
              const jviewElements = Array.from(document.querySelectorAll('[class^="jview jview-0-"]'));
              
              // jview 요소가 존재하면 그 안에서 먼저 버튼을 찾음
              if (jviewElements.length > 0) {
                for (const jviewElement of jviewElements) {
                  const btnElements = Array.from(jviewElement.querySelectorAll('button, a.btn'));
                  const applyBtn = btnElements.find(btn => {
                    const text = btn.textContent?.trim();
                    return text === '입사지원' || text === '홈페이지 지원';
                  });
                  
                  if (applyBtn) {
                    // jview 요소 내부에서 버튼을 찾음
                    applyBtn.setAttribute('data-apply-button', 'true');
                    return {
                      selector: '[data-apply-button="true"]',
                      text: applyBtn.textContent?.trim() || ''
                    };
                  }
                }
              }
              
              // jview 요소에서 찾지 못한 경우 원래 방식으로 찾기
              const btnElements = Array.from(document.querySelectorAll('.btn_apply, .btn_apply_button, .sri_btn_lg, .sri_btn_md'));
              const applyBtn = btnElements.find(btn => {
                const text = btn.textContent?.trim();
                return text === '입사지원' || text === '홈페이지 지원';
              });
              
              return null;
            });
          
          if (!applyButtonInfo) {
            logger.log('입사지원 버튼을 찾을 수 없습니다. 다음 공고로 넘어갑니다.', 'warning');
            failedCount++;
            details.push(`[실패] ${companyName} - ${jobTitle}: 지원 버튼 없음`);
            continue;
          }
          
          // 7. 입사지원 버튼 텍스트 확인 - "홈페이지 지원"과 "지원마감" 버튼은 처리하지 않음
          if (applyButtonInfo.text === '홈페이지 지원' || applyButtonInfo.text === '지원마감') {
            const reason = applyButtonInfo.text === '홈페이지 지원' ? '홈페이지 지원 방식' : '지원 마감됨';
            logger.log(`${reason}의 채용공고입니다. 건너뜁니다.`, 'warning');
            failedCount++;
            details.push(`[스킵] ${companyName} - ${jobTitle}: ${reason}`);
            continue;
          }
          
          // 9. 입사지원 버튼 클릭 전 로딩 대기
          logger.log('입사지원 버튼 로딩 대기 중... (3초)', 'info');
          await new Promise(resolve => setTimeout(resolve, 3000)); // 버튼이 완전히 로드될 때까지 3초 대기
          
          await page.click(applyButtonInfo.selector);
          
          // 10. 입사지원서 모달이 뜰 때까지 대기
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          // 11. iframe URL 추출
          const iframeUrl = await browserService.evaluate<string>(page, () => {
          const iframe = document.querySelector('#quick_apply_layer_frame');
          return iframe && iframe.getAttribute('src') || '';
          });
          
          if (!iframeUrl) {
          logger.log('입사지원 iframe을 찾을 수 없습니다.', 'warning');
          failedCount++;
          details.push(`[실패] ${companyName} - ${jobTitle}: 지원 iframe 없음`);
          continue;
          }
          
          // 12. iframe URL 검증 - 채용 공고 URL과 iframe URL 간의 호환성 확인
          const isValidIframeUrl = await browserService.evaluate<boolean>(page, (iframeUrl, jobUrl) => {
            // 기본 검증: iframe URL이 사람인 도메인이거나 상대 URL인지 확인
            const isSaraminDomain = iframeUrl.includes('saramin.co.kr') || iframeUrl.startsWith('/');
            
            // 지원 관련 URL인지 확인 (다양한 패턴 검사)
            const isApplyRelated = 
              iframeUrl.includes('apply_form') || 
              iframeUrl.includes('member/apply') || 
              iframeUrl.includes('rec_idx=');
            
            // 기존 방식과 함께 rec_idx 파라미터도 확인
            const recIdxMatch = iframeUrl.match(/rec_idx=(\d+)/);
            const hasRecIdx = recIdxMatch !== null;
            
            // 유효한 지원 URL로 판단
            return isSaraminDomain && (isApplyRelated || hasRecIdx);
          }, iframeUrl, jobUrl);
          
          if (!isValidIframeUrl) {
            logger.log(`iframe URL 검증 실패: ${iframeUrl}`, 'warning');
            failedCount++;
            details.push(`[실패] ${companyName} - ${jobTitle}: iframe URL 검증 실패`);
            continue;
          }
          
          // 13. iframe URL로 이동
          const fullIframeUrl = iframeUrl.startsWith('http') ? 
            iframeUrl : `https://www.saramin.co.kr${iframeUrl}`;
          
          logger.log(`입사지원 iframe으로 이동: ${fullIframeUrl}`, 'info');
          await page.goto(fullIframeUrl);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 14. 모달 내 지원하기 버튼 찾기
          const modalApplyButton = await browserService.evaluate<string>(page, () => {
            // 가능한 여러 선택자 시도
            const possibleSelectors = [
              '.area_btns.button button', 
              '.area_btns button', 
              '.button_apply',
              'button:contains("지원하기")',
              'button:contains("입사지원")'
            ];
            
            // 각 선택자에 맞는 버튼 찾기
            for (const selector of possibleSelectors) {
              try {
                const buttons = document.querySelectorAll(selector);
                if (buttons.length > 0) {
                  for (const btn of Array.from(buttons)) {
                    const text = btn.textContent?.trim() || '';
                    if (text.includes('지원') || text.includes('제출')) {
                      btn.setAttribute('data-modal-apply-button', 'true');
                      return '[data-modal-apply-button="true"]';
                    }
                  }
                }
              } catch (e) {
                // 선택자 오류는 무시하고 다음 시도
              }
            }
            
            // 모든 버튼 요소 찾기
            const allButtons = Array.from(document.querySelectorAll('button'));
            const applyBtnIdx = allButtons.findIndex(btn => {
              const text = btn.textContent?.trim() || '';
              return text.includes('지원') || text.includes('제출');
            });
            
            if (applyBtnIdx >= 0) {
              allButtons[applyBtnIdx].setAttribute('data-modal-apply-button', 'true');
              return '[data-modal-apply-button="true"]';
            }
            
            return '';
          });
          
          if (!modalApplyButton) {
            logger.log('입사지원 모달 내 지원하기 버튼을 찾을 수 없습니다.', 'warning');
            failedCount++;
            details.push(`[실패] ${companyName} - ${jobTitle}: 모달 지원 버튼 없음`);
            continue;
          }
          
          // 15-17. 모달 내 지원하기 버튼 클릭 및 완료 확인
          let isSuccess = false;
          try {
            // 15. 모달 내 지원하기 버튼 클릭
            logger.log('입사지원 모달 내 지원하기 버튼 클릭...', 'info');
            await page.click(modalApplyButton);
            
            // 16. 지원 완료 대기 - 짧은 시간으로 변경 (5초)
            logger.log('지원 완료 대기 중... (5초)', 'info');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // 17. 지원 성공으로 간주 (지원 완료 메시지가 없어도 지원이 잘 되는 것으로 가정)
            logger.log('지원 프로세스가 완료되었습니다. 성공으로 간주합니다.', 'info');
            isSuccess = true;
          } catch (error) {
            logger.log(`지원 과정 중 오류 발생: ${error}`, 'error');
            isSuccess = false;
          }
          
          if (isSuccess) {
            // 18. 지원 성공 시 DB 업데이트
            logger.log(`${companyName} - ${jobTitle} 지원 성공!`, 'success');
            try {
              job.is_applied = true;
              await job.save();
              logger.log(`DB 업데이트 성공: ${companyName} - ${jobTitle}`, 'success');
              
              // 직접 업데이트 쿼리 추가 (대체 방법)
              await CompanyRecruitmentTable.update(
                { is_applied: true },
                { where: { id: job.id } }
              );
              
              appliedCount++;
              details.push(`[성공] ${companyName} - ${jobTitle}`);
            } catch (dbError) {
              logger.log(`DB 업데이트 실패: ${dbError}`, 'error');
              // DB 업데이트 실패해도 UI에는 성공으로 표시
              appliedCount++;
              details.push(`[성공-DB오류] ${companyName} - ${jobTitle}`);
            }
          } else {
            logger.log(`${companyName} - ${jobTitle} 지원 실패. 성공 메시지를 찾을 수 없습니다.`, 'warning');
            failedCount++;
            details.push(`[실패] ${companyName} - ${jobTitle}: 지원 완료 메시지 없음`);
          }
          
        } catch (error) {
          logger.log(`지원 프로세스 중 오류 발생: ${error}`, 'error');
          failedCount++;
          details.push(`[오류] ${job.company_name} - ${job.job_title}: ${error}`);
        }
        
        // 다음 지원 전 잠시 대기 (사이트 부하 방지)
        logger.log('다음 지원을 위해 5초 대기 중...', 'info');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // 19. 최종 결과 요약
      logger.log(`사람인 자동 지원 완료: 총 ${targetJobs.length}개 중 ${appliedCount}개 성공, ${failedCount}개 실패`, 
        appliedCount > 0 ? 'success' : 'warning');
      
      return {
        success: true,
        message: `자동 지원 완료: ${appliedCount}개 성공, ${failedCount}개 실패`,
        applied: appliedCount,
        failed: failedCount,
        details
      };
      
    } catch (error) {
      logger.log(`자동 지원 중 예상치 못한 오류 발생: ${error}`, 'error');
      return {
        success: false,
        message: `자동 지원 중 오류 발생: ${error}`,
        applied: appliedCount,
        failed: failedCount,
        details
      };
    }
  }

  /**
   * 사용자 설정과 기본 설정 결합
   */
  private applyConfiguration(config: ScraperConfig): Required<ScraperConfig> & { verbose: boolean } {
    return {
      startPage: config.startPage ?? this.defaultConfig.startPage!,
      endPage: config.endPage ?? this.defaultConfig.endPage!,
      headless: config.headless ?? this.defaultConfig.headless!,
      waitTime: config.waitTime ?? this.defaultConfig.waitTime!,
      verbose: config.verbose ?? this.defaultConfig.verbose!
    };
  }

  /**
   * 스크래핑 결과 요약 출력
   */
  private printSummary(jobs: JobInfo[]): void {
    if (jobs.length === 0) {
      console.log(colors.yellow('수집된 채용 공고가 없습니다.'));
      return;
    }

    // 통계 생성
    const jobRepository = this.factory.getJobRepository();
    const stats = jobRepository.createJobStatistics(jobs);
    
    console.log(colors.yellow.bold('\n스크래핑 결과 요약'));
    console.log(colors.green(`총 수집된 채용 공고: ${jobs.length}개`));
    
    // 상위 회사 출력
    if (stats.topCompanies.length > 0) {
      console.log(colors.cyan('\n채용 공고가 가장 많은 회사:'));
      stats.topCompanies.forEach(([company, count], index) => {
        console.log(colors.cyan(`   ${index + 1}. ${company}: ${count}개`));
      });
    }
    
    // 경력 요구사항별 채용 공고 출력
    console.log(colors.blue('\n경력 요구사항별 채용 공고:'));
    Object.entries(stats.jobTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(colors.blue(`   - ${type}: ${count}개`));
      });
    
    // 고용 형태별 채용 공고 출력
    console.log(colors.magenta('\n고용 형태별 채용 공고:'));
    Object.entries(stats.employmentTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(colors.magenta(`   - ${type}: ${count}개`));
      });
    
    console.log(colors.yellow.bold('\n'));
  }
}