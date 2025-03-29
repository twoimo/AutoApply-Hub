import { MicroServiceABC } from "@qillie/wheel-micro-service";
import ApiCallService from "./ApiCallService";
import DataConverterService from "./DataConverterService";
import ScraperControlService from "../utils/ScraperControlService";
import { JobMatchingService, JobMatchResult } from "../utils/ai/JobMatchingService";
import { LoggerService } from "../utils/logging/LoggerService";
import { JobRepository } from "../utils/db/JobRepository";
import { ConfigService } from "../utils/config/ConfigService";
import { JobMatchingConstants } from "../utils/constants/AppConstants";

/**
 * @name 메인 서비스 노출 클래스
 * @domain main_service_communicate
 */
export default class MainServiceCommunicateService extends MicroServiceABC {
  /**
   * API 호출 서비스
   */
  private apiCallService = new ApiCallService([]);

  /**
   * 데이터 컨버터 서비스
   */
  private dataConverterService = new DataConverterService([]);

  /**
   * 스크래퍼 컨트롤 서비스
   */
  private scraperControlService = new ScraperControlService([]);
  
  /**
   * 채용공고 매칭 서비스 관련 변수
   */
  private matchingService: JobMatchingService | null = null;
  private logger: LoggerService;
  private jobRepository: JobRepository;
  private configService: ConfigService;
  
  constructor() {
    super([]);
    this.logger = new LoggerService(true);
    this.configService = new ConfigService();
    this.jobRepository = new JobRepository(this.logger);
    this.initializeMatchingService();
  }

  /**
   * 매칭 서비스 초기화
   */
  private async initializeMatchingService(): Promise<void> {
    try {
      // 환경 변수를 ConfigService에서 가져옴
      const mistralApiKey = this.configService.getMistralApiKey();
      
      if (!mistralApiKey) {
        throw new Error('Mistral API 키가 설정되지 않았습니다.');
      }
      
      this.matchingService = new JobMatchingService(
        this.logger,
        mistralApiKey,
        this.jobRepository
      );
      
      // 서비스 초기화
      await this.matchingService.initialize();
      this.logger.log('채용공고 매칭 서비스 초기화 완료', 'success');
    } catch (error) {
      this.logger.log(`채용공고 매칭 서비스 초기화 실패: ${error}`, 'error');
      // 초기화 실패 시 null로 설정하여 재시도 가능하게 함
      this.matchingService = null;
    }
  }

  /**
   * @name 테스트
   * @httpMethod get
   * @path /test
   */
  public async test({}: {}) {
    // 스크래퍼 컨트롤 서비스의 메소드 호출
    return await this.scraperControlService.openSaramin({});
  }

  /**
   * @name 시작 함수
   * @httpMethod get
   * @path /run
   */
  public async run({}: {}) {
    // 스크래퍼 컨트롤 서비스의 메소드 호출
    // return await this.scraperControlService.scheduleWeekdayScraping();
    return await this.scraperControlService.runAutoJobMatching();
  }
  
  /**
   * @name 채용공고 매칭 실행
   * @httpMethod get
   * @path /match-jobs
   * @objectParams {number} limit - 가져올 매칭되지 않은 채용공고 수 (기본값: 100)
   * @objectParams {number} matchLimit - 결과로 반환할 최대 매칭 수 (기본값: 100)
   */
  public async matchJobs({
    limit = JobMatchingConstants.DEFAULT_JOB_LIMIT,
    matchLimit = JobMatchingConstants.DEFAULT_MATCH_LIMIT
  }: {
    limit?: number;
    matchLimit?: number;
  }): Promise<{
    success: boolean;
    results?: JobMatchResult[];
    message?: string;
  }> {
    try {
      // 매칭 서비스가 없으면 초기화 시도
      if (!this.matchingService) {
        await this.initializeMatchingService();
        
        if (!this.matchingService) {
          return this.createErrorResponse('매칭 서비스 초기화에 실패했습니다. 설정을 확인해주세요.');
        }
      }
      
      // 매칭되지 않은 채용공고 수 확인
      const unmatchedCount = await this.jobRepository.countUnmatchedJobs();
      
      this.logger.log(`채용공고 매칭 시작 (총 ${unmatchedCount}개 중 최대 ${limit}개 처리, 상위 ${matchLimit}개 결과 반환)`, 'info');
      
      // 매칭 실행
      const results = await this.matchingService.matchJobsFromDb(limit, matchLimit);
      
      // 결과 저장
      if (results.length > 0) {
        await this.matchingService.saveMatchResults(results);
        this.logger.log(`총 ${results.length}개의 매칭 결과가 저장되었습니다.`, 'success');
      } else {
        this.logger.log('매칭 결과가 없습니다.', 'warning');
      }
      
      return {
        success: true,
        results,
        message: `${results.length}개 채용공고 매칭 완료`
      };
    } catch (error) {
      return this.createErrorResponse(`채용공고 매칭 중 오류가 발생했습니다: ${error}`);
    }
  }
  
  /**
   * @name 추천 채용공고 조회
   * @httpMethod get
   * @path /recommended-jobs
   * @objectParams {number} limit - 반환할 추천 채용공고 수 (기본값: 5)
   */
  public async getRecommendedJobs({
    limit = JobMatchingConstants.DEFAULT_MATCH_LIMIT
  }: {
    limit?: number;
  }): Promise<{
    success: boolean;
    results?: JobMatchResult[];
    message?: string;
  }> {
    try {
      // 추천 채용공고 가져오기 (점수 70점 이상, 지원 권장된 공고)
      const recommendedJobs = await this.jobRepository.getRecommendedJobs(limit);
      
      if (recommendedJobs.length === 0) {
        return {
          success: true,
          results: [],
          message: '추천 채용공고가 없습니다. 먼저 매칭을 실행해주세요.'
        };
      }
      
      this.logger.log(`${recommendedJobs.length}개의 추천 채용공고를 찾았습니다.`, 'success');
      
      return {
        success: true,
        results: recommendedJobs
      };
    } catch (error) {
      return this.createErrorResponse(`추천 채용공고를 가져오는 중 오류가 발생했습니다: ${error}`);
    }
  }
  
  /**
   * 에러 응답 생성 헬퍼 메서드
   */
  private createErrorResponse(message: string): {
    success: boolean;
    message: string;
  } {
    this.logger.log(message, 'error');
    return {
      success: false,
      message
    };
  }
}
