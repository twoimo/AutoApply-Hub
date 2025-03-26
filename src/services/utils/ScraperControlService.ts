import { ScraperServiceABC } from "@qillie/wheel-micro-service";
import { ScraperFactory } from "./ScraperFactory";
import { JobInfo, ScraperConfig } from "./types/JobTypes";
import colors from 'ansi-colors';
import path from 'path';
import cron from 'node-cron';

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

  constructor() {
    super([]);
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
        this.factory.getLogger().log('스케줄된 스크래핑 작업이 시작됩니다.', 'info');
        await this.runScheduledScraping(config);
      }, {
        scheduled: true,
        timezone: 'Asia/Seoul' // 한국 시간대 설정
      });
      
      this.factory.getLogger().log('스크래핑 작업이 한국 시간 주중 오후 5시(17:00)에 실행되도록 스케줄링되었습니다.', 'success');
      return true;
    } catch (error) {
      this.factory.getLogger().log(`스크래핑 작업 스케줄링 중 오류 발생: ${error}`, 'error');
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
    
    this.factory.getLogger().log('활성화된 스크래핑 스케줄이 없습니다.', 'warning');
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
    
    // 스크래핑 전 예비 검사 (첫 페이지만 확인)
    try {
      const browserService = this.factory.getBrowserService();
      const browser = await browserService.initializeBrowser(settings.headless);
      const page = await browserService.createPage();
      
      // 첫 페이지 URL 생성
      const pageUrl = saraminScraper.buildPageUrl(settings.startPage);
      
      // 페이지 로드
      const loadSuccess = await browserService.loadPageWithRetry(page, pageUrl, {
        waitForSelector: ".box_item",
        waitTime: settings.waitTime
      });
      
      if (!loadSuccess) {
        logger.log('페이지 로드 실패, 스크래핑 중단', 'error');
        await browserService.closeBrowser();
        return [];
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
      
      // 브라우저 종료
      await browserService.closeBrowser();
      
      if (links.length === 0) {
        logger.log('채용 공고를 찾을 수 없습니다.', 'warning');
        return [];
      }
      
      // 각 채용 공고 URL 생성
      const urlsToCheck = links.map(link => `https://www.saramin.co.kr${link}`);
      
      // 기존 URL 중복 확인
      const existingUrls = await jobRepository.checkExistingUrls(urlsToCheck);
      
      // 중복 체크
      const duplicatesCount = existingUrls.length;
      const newUrlsCount = urlsToCheck.length - duplicatesCount;
      
      logger.log(`${urlsToCheck.length}개 채용 공고 중 ${duplicatesCount}개는 이미 수집됨, ${newUrlsCount}개 새로운 공고 있음`, 
      newUrlsCount > 0 ? 'info' : 'warning');
      
      // 모든 URL이 중복인 경우
      if (duplicatesCount === urlsToCheck.length) {
        logger.log('모든 채용 공고가 이미 수집되었습니다. 스크래핑을 건너뜁니다.', 'warning');
        return [];
      }
      
      // 새 URL이 있는 경우 정상 스크래핑 진행
      logger.log(`새로운 채용 공고가 발견되었습니다. 스크래핑을 진행합니다.`, 'success');
      
    } catch (error) {
      logger.log(`URL 중복 검사 중 오류: ${error}`, 'error');
    }
    
    // 정상 스크래핑 프로세스 실행
    return await this.openSaramin(config);
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
    const { startPage, endPage, headless, waitTime, verbose } = settings;
    
    // 상세 로깅 설정
    this.factory.setVerboseLogging(verbose);
    
    const collectedJobs: JobInfo[] = [];
    
    logger.log(`사람인 채용 정보 스크래핑 시작 (페이지 ${startPage}부터)`, 'info');
    const startTime = Date.now();
    
    let consecutiveDuplicates = 0;
    let consecutiveEmptyPages = 0;
    let continueScrapping = true;
  
    try {
      // 브라우저 초기화
      const browser = await browserService.initializeBrowser(headless);
      const page = await browserService.createPage();
      
      let processedPages = 0;
  
      // 페이지별 처리
      for (let i = startPage; i <= endPage && continueScrapping; i++) {
        logger.log(`페이지 ${i} 처리 중...`);
        
        // 페이지 처리
        const result = await saraminScraper.processListPage(page, i, waitTime);
        
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
          break;
        }
        
        // continueScrapping 업데이트
        continueScrapping = result.shouldContinue;
        
        collectedJobs.push(...pageJobs);
        logger.log(`페이지 ${i} 완료: ${pageJobs.length}개 채용 공고 추출됨`, 'success');
      }
      
      // 결과 요약 출력
      this.printSummary(collectedJobs);
      
      const elapsedTime = (Date.now() - startTime) / 1000;
      logger.log(`총 소요 시간: ${elapsedTime.toFixed(2)}초`, 'success');
      
      return collectedJobs;
    } catch (error) {
      logger.log(`스크래핑 중 오류 발생: ${error}`, 'error');
      return collectedJobs;
    } finally {
      // 브라우저 종료
      await browserService.closeBrowser();
      logger.log(`브라우저 종료 및 스크래핑 완료`, 'success');
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
    
    console.log(colors.yellow.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(colors.yellow.bold('📊 스크래핑 결과 요약'));
    console.log(colors.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(colors.green(`✅ 총 수집된 채용 공고: ${jobs.length}개`));
    
    // 상위 회사 출력
    if (stats.topCompanies.length > 0) {
      console.log(colors.cyan('\n🏢 채용 공고가 가장 많은 회사:'));
      stats.topCompanies.forEach(([company, count], index) => {
        console.log(colors.cyan(`   ${index + 1}. ${company}: ${count}개`));
      });
    }
    
    // 경력 요구사항별 채용 공고 출력
    console.log(colors.blue('\n💼 경력 요구사항별 채용 공고:'));
    Object.entries(stats.jobTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(colors.blue(`   - ${type}: ${count}개`));
      });
    
    // 고용 형태별 채용 공고 출력
    console.log(colors.magenta('\n👔 고용 형태별 채용 공고:'));
    Object.entries(stats.employmentTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(colors.magenta(`   - ${type}: ${count}개`));
      });
    
    console.log(colors.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  }
}
