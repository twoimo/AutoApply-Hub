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
   * Vector Store를 활용한 채용공고 매칭 대체 구현
   * (간소화된 버전으로 일반 검색 수행)
   */
  public async matchJobsWithVectorStore(
    jobs: JobInfo[], 
    limit: number = JobMatchingConstants.DEFAULT_MATCH_LIMIT
  ): Promise<JobMatchResult[]> {
    try {
      await this.ensureInitialized();
      
      // 구직자 프로필을 기반으로 검색 쿼리 생성
      const profileText = formatCandidateProfile(this.candidateProfile);
      const searchQuery = this.createSearchQueryFromProfile(profileText);
      
      // 검색 수행 (실제 벡터 검색 대신 모든 채용공고를 Mistral에게 전달)
      const searchResults = await this.mistralService.searchJobsWithQuery(searchQuery, jobs);
      
      // 검색 결과 처리 및 반환
      return this.processMatchResults(searchResults, limit);
    } catch (error) {
      this.handleError('채용공고 검색 중 오류', error);
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
      // 데이터베이스에서 채용공고 가져오기 (최신순)
      const jobs = await this.jobRepository.getRecentJobs(limit);
      
      if (jobs.length === 0) {
        this.logger.log('매칭할 채용공고가 없습니다', 'warning');
        return [];
      }
      
      // 가져온 채용공고로 매칭 수행
      return await this.matchJobs(jobs, matchLimit);
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
}
