import { ScraperServiceABC } from "@qillie/wheel-micro-service";
import { ScraperFactory } from "./ScraperFactory";
import { JobInfo, ScraperConfig } from "./types/JobTypes";
import { JobMatchResult } from "./ai/JobMatchingService";
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
    
    logger.log(`사람인 채용 정보 스크래핑 시작 (페이지 ${settings.startPage}부터)`, 'info');
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
        logger.log(`페이지 ${i} 처리 중...`);
        
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
      
      // 스크래핑 완료 후 자동 매칭 실행
      if (collectedJobs.length > 0) {
        logger.log('스크래핑 완료 후 자동 매칭을 시작합니다...', 'info');
        await this.runAutoJobMatching();
      }
      
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
   * 스크래핑 후 자동으로 매칭 작업 실행
   * 매칭되지 않은 채용 공고만 대상으로 함
   */
  public async runAutoJobMatching(): Promise<void> {
    const logger = this.factory.getLogger();
    
    // 구분선으로 작업 시작 표시
    logger.logSeparator();
    logger.log('🤖 자동 채용 공고 매칭 작업을 시작합니다', 'info');
    logger.logSeparator();
    
    const startTime = Date.now();
    
    try {
      // 매칭 서비스 획득
      const jobRepository = this.factory.getJobRepository();
      
      // MainServiceCommunicateService 인스턴스 생성
      const mainService = new (require('../developer/MainServiceCommunicateService').default)();
      
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
        logger.log(`📋 배치 #${batchNumber} 매칭 작업 시작 (최대 ${batchSize}개)`, 'info');
        
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
        
        logger.log(`${unmatchedJobs.length}개의 매칭되지 않은 채용 공고 매칭 중...`, 'info');
        
        // 채용 공고 매칭 실행
        const matchResult = await mainService.matchJobs({
          limit: unmatchedJobs.length,
          matchLimit: 10
        });
        
        if (matchResult.success) {
          processedCount = unmatchedJobs.length;
          totalProcessed += processedCount;
          
          // 매칭 결과 요약
          if (matchResult.results && matchResult.results.length > 0) {
            logger.log(`매칭 결과: ${matchResult.results.length}개 매칭 완료`, 'success');
            
            // 상위 매칭 결과 로깅
            matchResult.results.slice(0, 3).forEach((result: JobMatchResult, idx: number) => {
              logger.log(`  ${idx+1}. ID ${result.id}: ${result.score}점 (${result.apply_yn ? '지원 권장' : '지원 비권장'})`, 
                result.apply_yn ? 'success' : 'warning');
            });
          } else {
            logger.log(`매칭은 성공했으나 결과가 없습니다.`, 'warning');
          }
          
          logger.log(`📦 배치 #${batchNumber} 완료: ${processedCount}개 처리됨, 총 ${totalProcessed}/${totalUnmatched}개`, 'success');
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
      logger.logSeparator();
      logger.log(`✅ 자동 매칭 작업 완료: 총 ${totalProcessed}개 채용 공고 처리됨 (소요 시간: ${elapsedTime}초)`, 'success');
      logger.logSeparator();
    } catch (error) {
      logger.log(`❌ 자동 매칭 중 오류 발생: ${error}`, 'error');
      
      // 오류 세부 정보 출력
      if (error instanceof Error && error.stack) {
        logger.logVerbose(`오류 스택: ${error.stack}`);
      }
      
      logger.logSeparator();
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

// fs 모듈 가져오기 (createReadStream 위해 필요)
import fs from 'fs';
