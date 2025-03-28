import { JobInfo } from '../types/JobTypes';
import { LoggerService } from '../logging/LoggerService';
import { OpenAIAssistantService } from './OpenAIAssistantService';
import { JobRepository } from '../db/JobRepository';
import { CandidateProfile } from './types/CandidateTypes';

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
  private openaiService: OpenAIAssistantService;
  private jobRepository: JobRepository;
  
  // OpenAI Assistant 관련 ID 정보
  private assistantId: string | null = null;
  private threadId: string | null = null;
  
  // 최연우 구직자 프로필 정보 (고정)
  private defaultCandidateProfile: CandidateProfile = {
    name: '최연우',
    education: [
      { degree: '석사', major: '컴퓨터공학', school: '동국대학교', period: '2022.03-2024.02' },
      { degree: '학사', major: '컴퓨터공학', school: '공주대학교', period: '2016.03-2022.02' }
    ],
    experience: [
      { role: '석사 연구원', company: '동국대학교', period: '2022.03-2024.02', description: '낙상 탐지 연구, ST-GCN 모델 활용' }
    ],
    skills: {
      ai_ml: ['PyTorch', 'TensorFlow', 'Keras', 'MMAction2', 'YOLO'],
      web_dev: ['HTML/CSS', 'JavaScript', 'Vue.js', 'Node.js', 'Flask'],
      data_analysis: ['Pandas', 'NumPy', 'Matplotlib', 'Seaborn'],
      others: ['Unreal Engine', 'Docker', 'Git']
    },
    projects: [
      { title: '낙상 탐지를 위한 합성 데이터 생성', tech: 'ST-GCN, PyTorch' },
      { title: '보안 취약점 분석 및 블록체인 기술 연구', tech: 'Python, 블록체인' },
      { title: '어종 판별 AI 웹 서비스', tech: 'YOLOv11, Flask, Vue.js' },
      { title: 'CCTV 시스템 개발 (AI 이상행동 탐지)', tech: 'OpenCV, PyTorch, Flask' }
    ],
    preferences: {
      fields: ['AI/ML 개발', '컴퓨터 비전', '보안', '웹 서비스 개발'],
      company_size: '중견기업 이상',
      industries: ['금융', '방산', '게임', 'AI 관련 기업'],
      location: '경기도 양주시'
    }
  };

  constructor(
    logger: LoggerService,
    openaiApiKey: string,
    jobRepository: JobRepository,
    assistantId?: string
  ) {
    this.logger = logger;
    this.openaiService = new OpenAIAssistantService(openaiApiKey, logger);
    this.jobRepository = jobRepository;
    this.assistantId = assistantId || null;
  }

  /**
   * 서비스 초기화
   */
  public async initialize(): Promise<void> {
    try {
      // 어시스턴트가 이미 존재하면 재사용
      if (!this.assistantId) {
        this.assistantId = await this.openaiService.initializeAssistant();
      } else {
        await this.openaiService.initializeAssistant(this.assistantId);
      }

      // 스레드가 이미 존재하면 재사용
      if (!this.threadId) {
        this.threadId = await this.openaiService.createThread();
      }
      
      this.logger.log('채용 매칭 서비스 초기화 완료', 'success');
    } catch (error) {
      this.logger.log(`채용 매칭 서비스 초기화 실패: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * 최연우의 고정 프로필을 문자열로 변환
   */
  private formatCandidateProfile(): string {
    const profile = this.defaultCandidateProfile;
    
    let profileText = `이름: ${profile.name}\n\n`;
    
    // 학력
    profileText += '학력:\n';
    for (const edu of profile.education) {
      profileText += `- ${edu.school} ${edu.major} ${edu.degree} (${edu.period})\n`;
    }
    profileText += '\n';
    
    // 경력
    profileText += '경력:\n';
    for (const exp of profile.experience) {
      profileText += `- ${exp.role}, ${exp.company} (${exp.period})\n  ${exp.description}\n`;
    }
    profileText += '\n';
    
    // 기술 스택
    profileText += '기술 스택:\n';
    profileText += `- 딥러닝/머신러닝: ${profile.skills.ai_ml.join(', ')}\n`;
    profileText += `- 웹 개발: ${profile.skills.web_dev.join(', ')}\n`;
    profileText += `- 데이터 분석: ${profile.skills.data_analysis.join(', ')}\n`;
    profileText += `- 기타: ${profile.skills.others.join(', ')}\n\n`;
    
    // 프로젝트 경험
    profileText += '연구/프로젝트 경험:\n';
    for (const proj of profile.projects) {
      profileText += `- ${proj.title} (${proj.tech})\n`;
    }
    profileText += '\n';
    
    // 희망 사항
    profileText += '희망 사항:\n';
    profileText += `- 희망 분야: ${profile.preferences.fields.join(', ')}\n`;
    profileText += `- 선호 기업 규모: ${profile.preferences.company_size}\n`;
    profileText += `- 관심 산업: ${profile.preferences.industries.join(', ')}\n`;
    profileText += `- 거주지: ${profile.preferences.location}\n`;
    
    return profileText;
  }

  /**
   * 채용공고 매칭 결과 분석
   */
  public async matchJobs(jobs: JobInfo[], limit: number = 10): Promise<JobMatchResult[]> {
    try {
      if (!this.assistantId) {
        await this.initialize();
      }
      
      this.logger.log(`${jobs.length}개 채용공고 매칭 시작`, 'info');
      
      // 구직자 프로필 문자열 생성
      const candidateProfileText = this.formatCandidateProfile();
      
      // OpenAI 어시스턴트를 통한 매칭 결과 가져오기
      const matchResults = await this.openaiService.sendJobsForMatching(
        jobs,
        candidateProfileText,
        this.threadId || undefined,
        this.assistantId || undefined
      );
      
      // 결과 처리 및 반환
      if (Array.isArray(matchResults)) {
        // 필요하다면 ID 없는 항목에 ID 추가
        const resultsWithIds = matchResults.map((result, index) => {
          if (!result.id && jobs[index]?.id) {
            return { ...result, id: jobs[index].id };
          }
          return result;
        });
        
        // 점수 기준으로 정렬하고 상위 N개 반환
        return resultsWithIds
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      } else {
        this.logger.log('예상치 못한 응답 형식', 'error');
        throw new Error('매칭 결과 처리 중 오류가 발생했습니다');
      }
    } catch (error) {
      this.logger.log(`채용공고 매칭 중 오류: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Vector Store를 활용한 채용공고 매칭
   */
  public async matchJobsWithVectorStore(jobs: JobInfo[], limit: number = 10): Promise<JobMatchResult[]> {
    try {
      // 1. 채용공고 데이터를 Vector Store에 업로드
      const fileId = await this.openaiService.uploadJobDataToVectorStore(jobs);
      
      // 2. 구직자 프로필을 기반으로 검색 쿼리 생성
      const profileText = this.formatCandidateProfile();
      const searchQuery = `
        다음 구직자 프로필에 가장 적합한 채용공고를 찾아주세요:
        ${profileText}
        
        구직자의 기술 스택, 경력, 선호 지역, 희망 분야와 가장 잘 매칭되는 채용공고를 점수 순으로 알려주세요.
      `;
      
      // 3. Vector Store 검색 수행
      const searchResults = await this.openaiService.searchJobsWithQuery(searchQuery, fileId);
      
      // 4. 검색 결과 처리 및 반환
      if (Array.isArray(searchResults)) {
        return searchResults
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      } else {
        this.logger.log('예상치 못한 검색 결과 형식', 'error');
        throw new Error('Vector Store 검색 결과 처리 중 오류가 발생했습니다');
      }
    } catch (error) {
      this.logger.log(`Vector Store 매칭 중 오류: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * 데이터베이스에서 채용공고를 가져와 매칭
   */
  public async matchJobsFromDb(limit: number = 10, matchLimit: number = 10): Promise<JobMatchResult[]> {
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
      this.logger.log(`DB 채용공고 매칭 실패: ${error}`, 'error');
      throw error;
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
      this.logger.log(`매칭 결과 저장 실패: ${error}`, 'error');
      throw error;
    }
  }
}
