import { MicroServiceABC } from "@qillie/wheel-micro-service";
import ScraperControlService from "../utils/ScraperControlService";
import { JobMatchingConstants } from "../utils/constants/AppConstants";
import { ScraperFactory } from "../utils/ScraperFactory";

/**
 * 메인 서비스 노출 클래스
 * @domain main_service_communicate
 */
export default class MainServiceCommunicateService extends MicroServiceABC {
  private scraperControlService: ScraperControlService;
  private factory: ScraperFactory;
  
  constructor() {
    super([]);
    // ScraperFactory를 통해 필요한 서비스 인스턴스를 얻음
    this.factory = ScraperFactory.getInstance();
    this.scraperControlService = new ScraperControlService([]);
    
    // 서비스 초기화
    this.factory.initializeServices();
  }

  /**
   * 테스트
   * @httpMethod get
   * @path /test
   */
  public async test({}: {}) {
    return await this.scraperControlService.openSaramin();
  }

  /**
   * 시작 함수
   * @httpMethod get
   * @path /run
   */
  public async run({}: {}) {
    return await this.scraperControlService.scheduleWeekdayScraping();
  }
  
  /**
   * 자동 채용공고 매칭 실행
   * @httpMethod get
   * @path /run-auto-job-matching
   * @objectParams {number} limit - 가져올 매칭되지 않은 채용공고 수 (기본값: 100)
   * @objectParams {number} matchLimit - 결과로 반환할 최대 매칭 수 (기본값: 100)
   */
  public async runAutoJobMatching({}: {}) {
    return await this.scraperControlService.runAutoJobMatching();
  }

  /**
   * 추천 채용공고 조회
   * @httpMethod get
   * @path /recommended-jobs
   * @objectParams {number} limit - 반환할 추천 채용공고 수 (기본값: 5)
   */
  public async getRecommendedJobs({
    limit = JobMatchingConstants.DEFAULT_MATCH_LIMIT
  }: {
    limit?: number;
  }) {
    return await this.factory.getRecommendedJobs(limit);
  }
  
  /**
   * 사람인 자동 지원
   * @httpMethod get
   * @path /apply-saramin-jobs
   */
  public async applySaraminJobs({}: {}) {
    return await this.scraperControlService.applySaraminJobs();
  }
}
