import { ScraperServiceABC } from "@qillie/wheel-micro-service";
import { ScraperFactory } from "./ScraperFactory";
import { JobInfo, ScraperConfig } from "./types/JobTypes";
import colors from 'ansi-colors';
import path from 'path';

/**
 * 스크래퍼 컨트롤 서비스 
 * 모듈화된 서비스들을 조율하고 스크래핑 작업을 제어합니다.
 */
export default class ScraperControlService extends ScraperServiceABC {
  private factory: ScraperFactory;
  
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
