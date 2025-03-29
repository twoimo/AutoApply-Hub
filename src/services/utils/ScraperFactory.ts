import path from 'path';
import dotenv from 'dotenv';
import { LoggerService } from './logging/LoggerService';
import { ImageProcessor } from './image/ImageProcessor';
import { OcrService } from './ocr/OcrService';
import { BrowserService } from './browser/BrowserService';
import { JobRepository } from './db/JobRepository';
import { SaraminScraper } from './scraper/SaraminScraper';
import { ConfigService } from './config/ConfigService';
import JobMatchingService, { JobMatchResult } from './ai/JobMatchingService';

// 환경 변수 로드
dotenv.config();

/**
 * 스크래퍼 서비스 팩토리
 * 필요한 모든 서비스를 생성하고 의존성 주입을 관리합니다.
 */
export class ScraperFactory {
  private static instance: ScraperFactory;
  private readonly tempDir: string;
  
  // 서비스 인스턴스
  private logger: LoggerService;
  private imageProcessor: ImageProcessor;
  private ocrService: OcrService;
  private browserService: BrowserService;
  private jobRepository: JobRepository;
  private saraminScraper: SaraminScraper;
  private configService: ConfigService;
  private matchingService: JobMatchingService | null = null;
  private verboseLogging: boolean = false;

  private constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
    
    // 로깅 서비스 초기화
    this.logger = new LoggerService(true);
    
    // 각 서비스 초기화
    this.imageProcessor = new ImageProcessor(this.tempDir, this.logger);
    this.ocrService = new OcrService(process.env.MISTRAL_API_KEY, this.logger, this.imageProcessor);
    this.browserService = new BrowserService(this.logger);
    this.jobRepository = new JobRepository(this.logger);
    this.configService = new ConfigService();
    
    // 스크래퍼 초기화
    this.saraminScraper = new SaraminScraper(
      this.logger,
      this.browserService,
      this.jobRepository,
      this.ocrService,
      this.imageProcessor
    );
  }

  /**
   * 싱글톤 인스턴스 획득
   */
  public static getInstance(): ScraperFactory {
    if (!ScraperFactory.instance) {
      ScraperFactory.instance = new ScraperFactory();
    }
    return ScraperFactory.instance;
  }

  /**
   * 모든 서비스 초기화
   */
  public async initializeServices(): Promise<void> {
    try {
      await this.initializeMatchingService();
    } catch (error) {
      this.logger.log(`서비스 초기화 중 오류 발생: ${error}`, 'error');
    }
  }

  /**
   * 매칭 서비스 초기화
   */
  public async initializeMatchingService(): Promise<void> {
    try {
      // 환경 변수를 ConfigService에서 가져옴
      const mistralApiKey = this.configService.getMistralApiKey();
      
      if (!mistralApiKey) {
        throw new Error('Mistral API 키가 설정되지 않았습니다.');
      }
      
      // JobMatchingService는 매개변수를 받지 않음
      this.matchingService = new JobMatchingService();
      
      // initialize 메서드는 존재하지 않으므로 제거
      this.logger.log('채용공고 매칭 서비스 초기화 완료', 'success');
    } catch (error) {
      this.logger.log(`채용공고 매칭 서비스 초기화 실패: ${error}`, 'error');
      // 초기화 실패 시 null로 설정하여 재시도 가능하게 함
      this.matchingService = null;
    }
  }

  /**
   * 로깅 상세 모드 설정
   */
  public setVerboseLogging(verbose: boolean): void {
    this.verboseLogging = verbose;
    this.logger.setVerbose(verbose);
  }

  /**
   * 채용공고 매칭 실행
   */
  public async matchJobs(limit: number, matchLimit: number) {
    if (!this.matchingService) {
      return {
        success: false,
        message: '매칭 서비스가 초기화되지 않았습니다.'
      };
    }
    // executeJobMatching 대신 matchJobs 사용
    return await this.matchingService.matchJobs({
      limit: limit,
      matchLimit: matchLimit
    });
  }

  /**
   * 추천 채용공고 조회
   */
  public async getRecommendedJobs(limit: number) {
    if (!this.matchingService) {
      return {
        success: false,
        message: '매칭 서비스가 초기화되지 않았습니다.'
      };
    }
    // JobMatchingService에 getRecommendedJobs 메서드가 없으므로 수정 필요
    // 현재 JobMatchingService에서 가능한 메서드를 사용
    const matchResult = await this.jobRepository.getRecommendedJobs(limit);
    return {
      success: true,
      recommendedJobs: matchResult
    };
  }

  // 각 서비스 획득 메서드
  public getLogger(): LoggerService {
    return this.logger;
  }

  public getImageProcessor(): ImageProcessor {
    return this.imageProcessor;
  }

  public getOcrService(): OcrService {
    return this.ocrService;
  }

  public getBrowserService(): BrowserService {
    return this.browserService;
  }

  public getJobRepository(): JobRepository {
    return this.jobRepository;
  }

  public getSaraminScraper(): SaraminScraper {
    return this.saraminScraper;
  }

  public getConfigService(): ConfigService {
    return this.configService;
  }

  public getMatchingService(): JobMatchingService | null {
    return this.matchingService;
  }
}
