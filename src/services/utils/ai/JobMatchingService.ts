import { getSystemInstructions } from './SystemInstructions';
import { getDefaultCandidateProfile, formatCandidateProfile } from './CandidateProfile';
import { ScraperFactory } from '../ScraperFactory';
import CompanyRecruitmentTable from '../../../models/main/CompanyRecruitmentTable';
import { Op } from 'sequelize';

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
 * OpenAI를 활용하여 채용 공고와 구직자 프로필을 매칭합니다.
 */
export default class JobMatchingService {
  private factory: ScraperFactory;
  private candidateProfile: any;

  constructor() {
    this.factory = ScraperFactory.getInstance();
    this.candidateProfile = getDefaultCandidateProfile();
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
      logger.log(`매칭되지 않은 채용 공고 최대 ${limit}개 가져오는 중...`, 'info');

      // 매칭되지 않은 채용 공고 가져오기
      const unmatchedJobs = await this.getUnmatchedJobs(limit);

      if (unmatchedJobs.length === 0) {
        return {
          success: true,
          message: '매칭할 채용 공고가 없습니다.',
          matchedJobs: []
        };
      }

      logger.log(`${unmatchedJobs.length}개의 채용 공고를 매칭 중...`, 'info');

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

      // ConfigService를 통해 OpenAI 서비스에 접근
      const configService = this.factory.getConfigService();
      
      // 시스템 지시사항 가져오기
      const systemInstructions = getSystemInstructions();
      
      // 요청 형식 구성
      const prompt = this.buildPrompt(jobsData);

      // 더미 결과를 생성하여 처리 로직 테스트
      const dummyResponse = {
        content: this.generateDummyResponse(jobsData)
      };

      /* 실제 OpenAI 서비스가 준비되면 아래 코드로 대체
      const response = await openaiService.createChatCompletion([
        { role: 'system', content: systemInstructions },
        { role: 'user', content: prompt }
      ]);
      */
      const response = dummyResponse;

      if (!response || !response.content) {
        return {
          success: false,
          message: 'AI 서비스 응답이 유효하지 않습니다.'
        };
      }

      // 응답 처리
      let matchResults: JobMatchResult[] = [];
      try {
        // JSON 응답 파싱
        const jsonText = this.extractJSON(response.content);
        matchResults = JSON.parse(jsonText);

        // 결과가 없으면 빈 배열로 처리
        if (!Array.isArray(matchResults)) {
          logger.log('AI 응답이 유효한 JSON 배열이 아닙니다.', 'error');
          return {
            success: false,
            message: 'AI 응답이 유효한 JSON 배열이 아닙니다.'
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
        await CompanyRecruitmentTable.update(
          {
            is_gpt_checked: true,
            match_score: result.score,
            match_reason: result.reason,
            strength: result.strength,
            weakness: result.weakness,
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
   * OpenAI 응답에서 JSON 부분만 추출
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

  /**
   * 테스트를 위한 더미 응답 생성
   */
  private generateDummyResponse(jobsData: any[]): string {
    const dummyResults = jobsData.map(job => {
      const score = Math.floor(Math.random() * 100);
      const apply = score >= 70;

      return {
        id: job.id,
        score: score,
        reason: `이 채용공고는 구직자의 ${apply ? '강점과 잘 맞습니다' : '약점이 있습니다'}. 점수: ${score}`,
        strength: `구직자의 기술 스택과 경험이 직무 요구사항과 ${apply ? '잘 맞습니다' : '일부 일치합니다'}`,
        weakness: `${apply ? '경력 기간이 약간 부족할 수 있습니다' : '기술 스택과 요구사항 간에 격차가 있습니다'}`,
        apply_yn: apply
      };
    });

    return JSON.stringify(dummyResults, null, 2);
  }
}
