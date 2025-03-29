import { JobInfo } from '../types/JobTypes';
import { LoggerService } from '../logging/LoggerService';
import { MistralAIService } from './MistralAIService';
import { JobRepository } from '../db/JobRepository';
import { ConfigService } from '../config/ConfigService';
import { JobMatchingConstants } from '../constants/AppConstants';
import { getDefaultCandidateProfile, formatCandidateProfile } from './CandidateProfile';

/**
 * 구직자-채용공고 매칭 결과 인터페이스
 */
export interface JobMatchResult {
  id: number;
  score: number;
  reason: string;
  strength: string;
  weakness: string;
  apply_yn: boolean;
  // 추가 정보 필드 (UI 표시용)
  companyName?: string;
  jobTitle?: string;
  jobLocation?: string;
  companyType?: string;
  url?: string;
}

/**
 * 채용정보 매칭 서비스
 * 구직자 프로필과 채용공고를 분석하여 적합성을 판단
 */
export class JobMatchingService {
  private logger: LoggerService;
  private mistralService: MistralAIService;
  private jobRepository: JobRepository;
  private configService: ConfigService;
  private initialized: boolean = false;
  
  // 기본 후보자 프로필
  private candidateProfile = getDefaultCandidateProfile();

  constructor(
    logger: LoggerService,
    mistralApiKey: string,
    jobRepository: JobRepository
  ) {
    this.logger = logger;
    this.mistralService = new MistralAIService(mistralApiKey, logger);
    this.jobRepository = jobRepository;
    this.configService = new ConfigService();
  }

  /**
   * 서비스 초기화
   */
  public async initialize(): Promise<void> {
    try {
      // Mistral 채팅 세션 초기화
      await this.mistralService.initializeChat();
      
      this.initialized = true;
      this.logger.log('채용 매칭 서비스 초기화 완료', 'success');
    } catch (error) {
      this.handleError('채용 매칭 서비스 초기화 실패', error);
    }
  }

  /**
   * 서비스 초기화 상태 확인 및 필요시 초기화
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 채용공고 매칭 결과 분석
   */
  public async matchJobs(
    jobs: JobInfo[], 
    limit: number = JobMatchingConstants.DEFAULT_MATCH_LIMIT
  ): Promise<JobMatchResult[]> {
    try {
      await this.ensureInitialized();
      
      this.logger.log(`${jobs.length}개 채용공고 매칭 시작`, 'info');
      
      // 구직자 프로필 문자열 생성
      const candidateProfileText = formatCandidateProfile(this.candidateProfile);
      
      // Mistral AI를 통한 매칭 결과 가져오기
      const matchResults = await this.mistralService.matchJobsWithProfile(
        jobs,
        candidateProfileText
      );
      
      // 결과 처리 및 반환
      return this.processMatchResults(matchResults, limit);
    } catch (error) {
      this.handleError('채용공고 매칭 중 오류', error);
    }
  }

  /**
   * 구직자 프로필을 기반으로 검색 쿼리 생성
   */
  private createSearchQueryFromProfile(profileText: string): string {
    return `
      다음 구직자 프로필에 가장 적합한 채용공고를 찾아주세요:
      ${profileText}
      
      구직자의 기술 스택, 경력, 선호 지역, 희망 분야와 가장 잘 매칭되는 채용공고를 점수 순으로 알려주세요.
    `;
  }

  /**
   * 매칭 결과 처리
   */
  private processMatchResults(results: any, limit: number): JobMatchResult[] {
    if (!Array.isArray(results)) {
      this.logger.log('예상치 못한 응답 형식', 'error');
      throw new Error('매칭 결과 처리 중 오류가 발생했습니다');
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * 에러를 표준화된 방식으로 처리
   */
  private handleError(message: string, error: any): never {
    this.logger.log(`${message}: ${error}`, 'error');
    throw error instanceof Error ? error : new Error(`${message}: ${error}`);
  }

  /**
   * 데이터베이스에서 채용공고를 가져와 매칭
   */
  public async matchJobsFromDb(
    limit: number = JobMatchingConstants.DEFAULT_JOB_LIMIT, 
    matchLimit: number = JobMatchingConstants.DEFAULT_MATCH_LIMIT
  ): Promise<JobMatchResult[]> {
    try {
      // 데이터베이스에서 매칭되지 않은 채용공고 가져오기 (ID 오름차순)
      const jobs = await this.jobRepository.getUnmatchedJobs(limit);
      
      if (jobs.length === 0) {
        this.logger.log('매칭할 채용공고가 없습니다', 'warning');
        return [];
      }
      
      this.logger.log(`${jobs.length}개의 매칭되지 않은 채용 공고를 매칭합니다...`, 'info');
      
      // 채용공고 ID 목록 출력
      const jobIds = jobs.map(job => job.id).join(', ');
      this.logger.log(`매칭 대상 ID: ${jobIds}`, 'info');
      
      // 구직자 프로필 문자열 생성
      const candidateProfileText = formatCandidateProfile(this.candidateProfile);
      
      // Mistral AI를 통한 매칭 결과 가져오기
      const matchResults = await this.mistralService.matchJobsWithProfile(
        jobs,
        candidateProfileText
      );
      
      // 결과 처리 및 필터링
      const processedResults = this.processMatchResults(matchResults, matchLimit);
      
      // 결과 요약 출력
      this.logger.log(`매칭 결과: ${processedResults.length}개 매칭됨`, 'success');
      processedResults.forEach((result, idx) => {
        this.logger.log(`[${idx+1}] ID ${result.id}: ${result.score}점 (${result.apply_yn ? '지원 권장' : '지원 비권장'})`, 
          result.apply_yn ? 'success' : 'warning');
      });
      
      // 매칭 상태 업데이트 (전체 매칭 대상 채용공고를 처리됨으로 표시)
      await this.jobRepository.updateMatchedStatus(jobs.map(job => job.id as number));
      
      return processedResults;
    } catch (error) {
      this.handleError('DB 채용공고 매칭 실패', error);
    }
  }

  /**
   * 매칭 결과를 데이터베이스에 저장
   */
  public async saveMatchResults(results: JobMatchResult[]): Promise<void> {
    try {
      for (const result of results) {
        await this.jobRepository.updateJobWithMatchResult(
          result.id,
          result.score,
          result.reason,
          result.apply_yn,
          result.strength,
          result.weakness
        );
      }
      
      this.logger.log(`${results.length}개 매칭 결과 저장 완료`, 'success');
    } catch (error) {
      this.handleError('매칭 결과 저장 실패', error);
    }
  }

  /**
   * 채용공고 매칭 실행
   */
  public async executeJobMatching(
    limit: number,
    matchLimit: number
  ): Promise<{
    success: boolean;
    results?: JobMatchResult[];
    message?: string;
  }> {
    try {
      // 매칭되지 않은 채용공고 수 확인
      const unmatchedCount = await this.jobRepository.countUnmatchedJobs();
      
      this.logger.log(`채용공고 매칭 시작 (총 ${unmatchedCount}개 중 최대 ${limit}개 처리, 상위 ${matchLimit}개 결과 반환)`, 'info');
      
      // 매칭 실행
      const results = await this.matchJobsFromDb(limit, matchLimit);
      
      // 결과 저장
      if (results.length > 0) {
        await this.saveMatchResults(results);
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
      this.logger.log(`채용공고 매칭 중 오류가 발생했습니다: ${error}`, 'error');
      return {
        success: false,
        message: `채용공고 매칭 중 오류가 발생했습니다: ${error}`
      };
    }
  }

  /**
   * 추천 채용공고 조회
   */
  public async getRecommendedJobs(limit: number): Promise<{
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
      this.logger.log(`추천 채용공고를 가져오는 중 오류가 발생했습니다: ${error}`, 'error');
      return {
        success: false,
        message: `추천 채용공고를 가져오는 중 오류가 발생했습니다: ${error}`
      };
    }
  }
}
