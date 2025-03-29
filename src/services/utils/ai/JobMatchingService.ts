import { getSystemInstructions } from './SystemInstructions';
import { getDefaultCandidateProfile, formatCandidateProfile } from './CandidateProfile';
import { ScraperFactory } from '../ScraperFactory';
import CompanyRecruitmentTable from '../../../models/main/CompanyRecruitmentTable';
import { Op } from 'sequelize';
import { MistralAIService } from './MistralAIService';
import { JobInfo } from '../types/JobTypes';

/**
 * 일자리 매칭 결과 인터페이스
 */
export interface JobMatchResult {
  id: number;
  score: number;
  reason: string;
  strength: string;
  weakness: string;
  apply_yn: boolean;
}

/**
 * 일자리 매칭 옵션 인터페이스
 */
export interface JobMatchOptions {
  limit?: number;
  matchLimit?: number;
}

/**
 * AI 기반 일자리 매칭 서비스
 * Mistral AI를 활용하여 채용 공고와 구직자 프로필을 매칭합니다.
 */
export default class JobMatchingService {
  private factory: ScraperFactory;
  private candidateProfile: any;
  private mistralService: MistralAIService | null = null;

  constructor() {
    this.factory = ScraperFactory.getInstance();
    this.candidateProfile = getDefaultCandidateProfile();
    this.initMistralService();
  }

  /**
   * Mistral 서비스 초기화
   */
  private async initMistralService(): Promise<void> {
    const configService = this.factory.getConfigService();
    const logger = this.factory.getLogger();
    const mistralApiKey = configService.getMistralApiKey();
    
    if (!mistralApiKey) {
      logger.log('Mistral API 키가 설정되지 않았습니다.', 'error');
      return;
    }
    
    this.mistralService = new MistralAIService(mistralApiKey, logger);
  }

  /**
   * 구직자 프로필과 일치하는 채용 공고를 찾아 매칭
   */
  public async matchJobs(options: JobMatchOptions = {}): Promise<{
    success: boolean;
    message: string;
    matchedJobs?: JobMatchResult[];
  }> {
    const logger = this.factory.getLogger();
    const limit = options.limit || 100;
    const matchLimit = options.matchLimit || 100;

    try {
      // 매칭되지 않은 채용 공고 가져오기
      const unmatchedJobs = await this.getUnmatchedJobs(limit);

      if (unmatchedJobs.length === 0) {
        return {
          success: true,
          message: '매칭할 채용 공고가 없습니다.',
          matchedJobs: []
        };
      }

      logger.log(`Mistral AI를 사용하여 ${unmatchedJobs.length}개의 채용 공고를 매칭 중...`, 'info');

      // AI 매칭 요청 준비
      const jobsData = unmatchedJobs.map(job => ({
        id: job.id,
        companyName: job.company_name,
        jobTitle: job.job_title,
        companyType: job.company_type,
        jobLocation: job.job_location,
        jobType: job.job_type,
        jobSalary: job.job_salary,
        deadline: job.deadline,
        url: job.job_url,
        employmentType: job.employment_type,
        jobDescription: job.job_description
      }));

      // Mistral 서비스가 초기화되지 않았으면 초기화
      if (!this.mistralService) {
        await this.initMistralService();
        
        if (!this.mistralService) {
          return {
            success: false,
            message: 'Mistral AI 서비스를 초기화할 수 없습니다.'
          };
        }
      }
      
      // 구직자 프로필 포맷팅
      const candidateProfileText = formatCandidateProfile(this.candidateProfile);
      
      // Mistral AI로 채용공고 매칭 실행
      const response = await this.mistralService.matchJobsWithProfile(
        jobsData as JobInfo[], 
        candidateProfileText
      );

      if (!response) {
        return {
          success: false,
          message: 'Mistral AI 서비스 응답이 유효하지 않습니다.'
        };
      }

      // 응답 처리
      let matchResults: JobMatchResult[] = [];
      try {
        // 응답이 이미 JSON 객체인지 문자열인지 확인
        if (typeof response === 'string') {
          // JSON 응답 파싱
          const jsonText = this.extractJSON(response);
          matchResults = JSON.parse(jsonText);
        } else if (Array.isArray(response)) {
          // 이미 파싱된 배열인 경우
          matchResults = response;
        } else {
          throw new Error('Mistral AI 응답이 예상 형식과 다릅니다.');
        }

        // 결과가 없으면 빈 배열로 처리
        if (!Array.isArray(matchResults)) {
          logger.log('Mistral AI 응답이 유효한 JSON 배열이 아닙니다.', 'error');
          return {
            success: false,
            message: 'Mistral AI 응답이 유효한 JSON 배열이 아닙니다.'
          };
        }

        // DB 업데이트 (매칭 결과 저장)
        await this.updateMatchResults(matchResults);

        // 매칭 결과 중 추천된 항목만 반환 (matchLimit 개수만큼)
        const recommendedJobs = matchResults
          .filter(job => job.apply_yn)
          .slice(0, matchLimit);

        logger.log(`매칭 완료: ${matchResults.length}개 중 ${recommendedJobs.length}개 추천됨`, 'success');

        return {
          success: true,
          message: `${matchResults.length}개의 채용 공고 매칭이 완료되었습니다.`,
          matchedJobs: recommendedJobs
        };
      } catch (error) {
        logger.log(`매칭 결과 처리 중 오류: ${error}`, 'error');
        return {
          success: false,
          message: `매칭 결과 처리 중 오류: ${error}`
        };
      }
    } catch (error) {
      logger.log(`매칭 프로세스 중 오류 발생: ${error}`, 'error');
      return {
        success: false,
        message: `매칭 중 오류: ${error}`
      };
    }
  }

  /**
   * 매칭되지 않은 채용 공고 가져오기
   */
  private async getUnmatchedJobs(limit: number): Promise<CompanyRecruitmentTable[]> {
    return await CompanyRecruitmentTable.findAll({
      where: {
        [Op.or]: [
          { is_gpt_checked: false },
          { is_gpt_checked: null }
        ]
      },
      order: [['id', 'ASC']],
      limit
    });
  }

  /**
   * 매칭 결과를 DB에 업데이트
   */
  private async updateMatchResults(results: JobMatchResult[]): Promise<void> {
    const logger = this.factory.getLogger();
    logger.log(`${results.length}개의 매칭 결과를 DB에 업데이트 중...`, 'info');

    for (const result of results) {
      try {
        // 필드 값 타입 확인 및 문자열로 변환
        const reason = typeof result.reason === 'object' ? 
          JSON.stringify(result.reason) : String(result.reason);
        
        const strength = typeof result.strength === 'object' ? 
          JSON.stringify(result.strength) : String(result.strength);
        
        const weakness = typeof result.weakness === 'object' ? 
          JSON.stringify(result.weakness) : String(result.weakness);
          
        // 대괄호와 쌍따옴표 제거 (문자열의 처음과 끝에 있는 경우)
        const cleanReason = reason.replace(/^\[|\]$|^"|"$/g, '');
        const cleanStrength = strength.replace(/^\[|\]$|^"|"$/g, '');
        const cleanWeakness = weakness.replace(/^\[|\]$|^"|"$/g, '');

        await CompanyRecruitmentTable.update(
          {
            is_gpt_checked: true,
            match_score: result.score,
            match_reason: cleanReason,
            strength: cleanStrength,
            weakness: cleanWeakness,
            is_recommended: result.apply_yn
          },
          {
            where: { id: result.id }
          }
        );
      } catch (error) {
        logger.log(`ID ${result.id} 매칭 결과 업데이트 실패: ${error}`, 'error');
      }
    }

    // 매칭 완료된 결과 10개 콘솔에 출력
    logger.log('매칭 결과 요약 (상위 10개):', 'info', true);
    
    // 점수 내림차순으로 정렬하여 상위 10개만 표시
    const topResults = [...results]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    // 결과 출력 포맷팅
    topResults.forEach(result => {
      const recommendText = result.apply_yn ? '(추천)' : '(비추천)';
      logger.log(`ID: ${result.id}, 점수: ${result.score} ${recommendText}`, result.apply_yn ? 'success' : 'warning');
    });

    logger.log('매칭 결과 DB 업데이트 완료', 'success');
  }

  /**
   * 채용 공고 데이터를 기반으로 프롬프트 구성
   */
  private buildPrompt(jobsData: any[]): string {
    // 구직자 프로필 포맷팅
    const profileText = formatCandidateProfile(this.candidateProfile);
    
    // 채용 공고 데이터를 JSON 문자열로 변환
    const jobsJson = JSON.stringify(jobsData, null, 2);
    
    return `다음 채용 공고들과 구직자 프로필을 매칭해 주세요.

구직자 프로필:
${profileText}

채용 공고 데이터:
${jobsJson}

각 채용 공고에 대해 구직자의 적합도를 평가하고, 제시된 형식으로 결과를 반환해 주세요.`;
  }

  /**
   * AI 응답에서 JSON 부분만 추출
   */
  private extractJSON(text: string): string {
    // JSON 시작과 끝 부분을 찾아 추출 (s 플래그 제거)
    const jsonMatch = text.match(/\[\s*\{.*\}\s*\]/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    
    // 정규식으로 추출 실패 시 전체 텍스트 반환
    return text;
  }
}
