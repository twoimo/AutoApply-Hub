import path from 'path';
import dotenv from 'dotenv';
import { LoggerService } from './logging/LoggerService';
import { ImageProcessor } from './image/ImageProcessor';
import { OcrService } from './ocr/OcrService';
import { BrowserService } from './browser/BrowserService';
import { JobRepository } from './db/JobRepository';
import { SaraminScraper } from './scraper/SaraminScraper';

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

  private constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
    
    // 로깅 서비스 초기화
    this.logger = new LoggerService(false);
    
    // 각 서비스 초기화
    this.imageProcessor = new ImageProcessor(this.tempDir, this.logger);
    this.ocrService = new OcrService(process.env.MISTRAL_API_KEY, this.logger, this.imageProcessor);
    this.browserService = new BrowserService(this.logger);
    this.jobRepository = new JobRepository(this.logger);
    
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
   * 로깅 상세 모드 설정
   */
  public setVerboseLogging(verbose: boolean): void {
    this.logger.setVerbose(verbose);
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
}
