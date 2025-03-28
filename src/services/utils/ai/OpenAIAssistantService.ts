import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { LoggerService } from '../logging/LoggerService';
import { JobInfo } from '../types/JobTypes';
import { OpenAIConfigManager } from './OpenAIConfigManager';

dotenv.config();

/**
 * OpenAI API와 상호작용하고 Assistant 기능을 활용하는 서비스
 */
export class OpenAIAssistantService {
  private openai: OpenAI;
  private logger: LoggerService;
  private assistantId: string | null = null;
  private threadId: string | null = null;
  private apiKey: string;
  private readonly systemInstructions: string;

  constructor(apiKey: string, logger: LoggerService) {
    this.apiKey = apiKey;
    this.logger = logger;
    this.openai = new OpenAI({
      apiKey: this.apiKey
    });

    // 로컬 파일에서 기존 assistantId, threadId 불러오기
    const persisted = OpenAIConfigManager.loadConfig();
    if (persisted.assistantId) this.assistantId = persisted.assistantId;
    if (persisted.threadId) this.threadId = persisted.threadId;

    // 시스템 지시사항 로드
    this.systemInstructions = this.loadSystemInstructions();
  }

  /**
   * 시스템 지시사항 로드 
   */
  private loadSystemInstructions(): string {
    try {
      // 상세한 시스템 지시사항 설정
      return `당신은 구직자와 사람인의 채용공고를 매칭하는 AI 어시스턴트입니다. 채용 데이터베이스에서 가져온 정보를 분석하여 구직자와의 적합성을 판단합니다.

역할:
- 채용공고와 구직자 간의 적합성을 정밀하게 평가
- 데이터가 부족하더라도 가용한 정보를 기반으로 평가 수행
- 적합한 채용공고 목록과 그 이유를 제공
- 채용 공고별 지원 추천 여부 결정 (apply_yn 값 결정)

구직자 프로필:
- 이름: 최연우 (Yeonwoo Choi)
- 학력: 동국대학교 컴퓨터공학 석사 (2022.03-2024.02), 공주대학교 컴퓨터공학 학사 (2016.03-2022.02)
- 경력: 석사 연구 경력 2년 (2022.03-2024.02)
- 기술 스택: 
  * 딥러닝/머신러닝: PyTorch, TensorFlow, Keras, MMAction2, YOLO
  * 웹 개발: HTML/CSS, JavaScript, Vue.js, Node.js, Flask
  * 데이터 분석: Pandas, NumPy, Matplotlib, Seaborn
  * 기타: Unreal Engine, Docker, Git
- 연구/프로젝트 경험: 
  * 낙상 탐지를 위한 합성 데이터 생성 (ST-GCN 모델)
  * 보안 취약점 분석 및 블록체인 기술 연구
  * 어종 판별 AI 웹 서비스 개발 (YOLOv11 활용)
  * CCTV 시스템 개발 (AI 이상행동 탐지)
- 희망 분야: AI/ML 개발, 컴퓨터 비전, 보안, 웹 서비스 개발
- 선호 기업 규모: 중견기업 이상
- 관심 산업: 금융, 방산, 게임, AI 관련 기업
- 거주지: 경기도 양주시

평가 대상 채용공고 정보:
- company_name: 회사명 (필수 항목)
- job_title: 직무 제목 (필수 항목)
- company_type: 회사 형태 (예: 대기업, 중견기업, 중소기업, 스타트업)
- job_location: 근무 지역 (예: 서울시 강남구, 경기도 성남시)
- job_type: 경력 조건 (예: 신입, 경력 3년 이상)
- job_salary: 급여 정보 (예: 3,000만원 이상, 회사 내규에 따름)
- deadline: 지원 마감일 (예: 2025-03-31, 상시채용)
- job_url: 채용공고 URL

평가 프로세스:
1. 모든 데이터 필드가 비어있는지(null) 확인
2. 필수 항목(company_name, job_title)이 있는지 확인하고, 없을 경우 제외
3. company_type 데이터의 정확성을 위해 company_name을 온라인 검색하여 실제 기업 규모(대기업, 중견기업, 중소기업, 스타트업)를 확인
4. 가용한 데이터를 기반으로 아래 기준에 따라 평가 진행
5. 각 기준별 점수화하여 종합 평가 실시 (0-100점 척도)

평가 기준 (세부):
1. 직무 적합성 (40점)
   - job_title에 다음 키워드 중 포함 개수에 따라 점수 부여:
     * 최우선(각 10점): AI, 인공지능, 머신러닝, 딥러닝, 컴퓨터 비전, 영상처리
     * 우선(각 8점): 보안, 블록체인, 데이터 분석, 데이터 사이언스, 연구, 개발
     * 적합(각 6점): 웹 개발, 풀스택, 프론트엔드, 백엔드, 소프트웨어 개발
     * 고려(각 4점): 엔지니어, 프로그래머, 개발자, IT, 기술
   - 최대 40점까지만 인정

2. 기술 스택 일치성 (20점)
   - job_title 또는 job_description에 다음 기술 키워드가 포함될 경우 점수 부여:
     * 딥러닝 기술(각 5점): PyTorch, TensorFlow, Keras, YOLO, CNN, GCN, 딥러닝
     * 웹 개발(각 4점): Vue.js, Node.js, Flask, React, JavaScript
     * 데이터 분석(각 3점): Python, Pandas, NumPy, 데이터 분석, 시각화
     * 기타 기술(각 2점): Unreal Engine, Docker, Git, 클라우드
   - 최대 20점까지만 인정

3. 경력 요구사항 부합성 (15점)
   - 신입/경력무관: 15점
   - 석사 우대/석사 신입: 15점
   - 경력 1-2년 이하: 12점
   - 경력 3년: 8점
   - 경력 4-5년: 5점
   - 경력 6년 이상: 0점
   - 데이터가 없는 경우: 10점 (평균 점수 부여)

4. 지역 적합성 (10점)
   - 재택/원격/하이브리드: 10점
   - 경기 북부(양주, 의정부, 동두천): 10점
   - 서울 북부(노원, 도봉): 9점
   - 서울(그 외 지역): 7점
   - 경기도(그 외 지역): 6점
   - 인천: 5점
   - 그 외 지역: 2점
   - 데이터가 없는 경우: 6점 (평균 점수 부여)

5. 기업 규모 및 산업 분야 (15점)
   - 대기업 + 관심 산업(금융, 방산, 게임, AI): 15점
   - 대기업(그 외 산업): 12점
   - 중견기업 + 관심 산업: 13점
   - 중견기업(그 외 산업): 10점
   - 공기업/공공기관: 12점
   - 스타트업 + 관심 산업: 8점
   - 중소기업 + 관심 산업: 7점
   - 중소기업/스타트업(그 외 산업): 5점
   - 데이터가 없는 경우: 8점 (평균 점수 부여)

종합 점수 기반 지원 권장 결정:
- 85점 이상: 적극 지원 권장 (apply_yn: true)
- 70-84점: 지원 권장 (apply_yn: true)
- 55-69점: 검토 후 지원 (apply_yn: false)
- 54점 이하: 지원 비권장 (apply_yn: false)

추가 판단 요소 (가감점):
- 마감 임박(3일 이내): -5점 (준비 시간 부족)
- AI 연구직/석사 우대 명시: +5점
- 급여가 명시되어 있고 4,000만원 이상: +3점
- 관심 산업(금융, 방산, 게임, AI) 명시: +3점

출력 형식:
다음과 같은 JSON 형식으로 결과를 반환해주세요:
[
  {
    "id": 채용공고 ID,
    "score": 종합 점수,
    "reason": "이 채용공고는 [주요 적합성 이유 1-3개 요약]",
    "strength": "[지원자의 강점과 직무 연관성]",
    "weakness": "[지원자와 직무 간 격차 또는 불일치점]",
    "apply_yn": true/false
  },
  ...
]`;
    } catch (error) {
      this.logger.log(`시스템 지시사항 로드 실패: ${error}`, 'error');
      return '';
    }
  }

  /**
   * OpenAI Assistant 생성 또는 기존 어시스턴트 사용
   */
  public async initializeAssistant(assistantId?: string): Promise<string> {
    // 이미 값이 있다면 새로 안 만듦
    if (this.assistantId) {
      this.logger.log(`이미 생성된 어시스턴트 사용: ${this.assistantId}`, 'info');
      return this.assistantId;
    }
    try {
      if (assistantId) {
        this.assistantId = assistantId;
        this.logger.log(`기존 어시스턴트 사용: ${this.assistantId}`, 'info');
        return this.assistantId;
      }

      // 새 어시스턴트 생성
      const assistant = await this.openai.beta.assistants.create({
        name: "채용정보 매칭 어시스턴트",
        description: "구직자 프로필과 채용공고 간의 적합성을 평가",
        model: "gpt-4o",
        instructions: this.systemInstructions,
        tools: [{ type: "file_search" }] // "retrieval" 대신 "file_search" 사용
      });
      this.assistantId = assistant.id;
      this.logger.log(`어시스턴트 생성 완료: ${this.assistantId}`, 'success');

      // 새로 생성 성공 시 파일에 저장
      OpenAIConfigManager.saveConfig({
        assistantId: this.assistantId ?? undefined,
        threadId: this.threadId ?? undefined,
      });

      return this.assistantId;
    } catch (error) {
      this.logger.log(`어시스턴트 초기화 실패: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * 채팅 스레드 생성 (기존 스레드 있으면 재사용)
   */
  public async createThread(): Promise<string> {
    // 이미 값이 있다면 새로 안 만듦
    if (this.threadId) {
      this.logger.log(`기존 스레드 사용: ${this.threadId}`, 'info');
      return this.threadId;
    }
    try {
      // 새 스레드 생성
      const thread = await this.openai.beta.threads.create();
      this.threadId = thread.id;
      this.logger.log(`스레드 생성 완료: ${this.threadId}`, 'success');

      // 새로 생성 성공 시 파일에 저장
      OpenAIConfigManager.saveConfig({
        assistantId: this.assistantId ?? undefined,
        threadId: this.threadId,
      });

      return this.threadId;
    } catch (error) {
      this.logger.log(`스레드 생성 실패: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * 구직자 프로필 및 채용공고 정보로 메시지 전송
   */
  public async sendJobsForMatching(
    jobs: JobInfo[],
    candidateProfile: string,
    threadId?: string,
    assistantId?: string
  ): Promise<any> {
    try {
      // 어시스턴트 ID 확인
      if (!this.assistantId && !assistantId) {
        await this.initializeAssistant();
      } else if (assistantId && assistantId !== this.assistantId) {
        this.assistantId = assistantId;
      }

      // 스레드 ID 확인
      if (!this.threadId && !threadId) {
        await this.createThread();
      } else if (threadId && threadId !== this.threadId) {
        this.threadId = threadId;
      }

      if (!this.threadId || !this.assistantId) {
        throw new Error('스레드 또는 어시스턴트가 초기화되지 않았습니다.');
      }

      // 구직자 프로필 메시지 전송
      await this.openai.beta.threads.messages.create(
        this.threadId,
        {
          role: "user",
          content: `# 구직자 프로필\n\n${candidateProfile}`
        }
      );

      // 채용공고 데이터 전송
      const jobsData = JSON.stringify(jobs, null, 2);
      await this.openai.beta.threads.messages.create(
        this.threadId,
        {
          role: "user",
          content: `# 평가할 채용공고 목록\n\n${jobsData}`
        }
      );

      // 요청 실행
      const run = await this.openai.beta.threads.runs.create(
        this.threadId,
        { assistant_id: this.assistantId }
      );

      // 요청 완료 대기
      const result = await this.waitForRunCompletion(this.threadId, run.id);
      return result;
    } catch (error) {
      this.logger.log(`채용공고 평가 요청 실패: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * 채용 공고 데이터를 파일로 업로드하고 Vector Store에 저장
   */
  public async uploadJobDataToVectorStore(jobs: JobInfo[]): Promise<string> {
    try {
      // 임시 파일 생성
      const tempFilePath = path.join(process.cwd(), 'temp', `jobs_${Date.now()}.jsonl`);
      
      // 임시 디렉토리가 없으면 생성
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // JSONL 형식으로 변환 (각 라인이 독립적인 JSON 객체)
      const jsonlData = jobs.map(job => JSON.stringify(job)).join('\n');
      fs.writeFileSync(tempFilePath, jsonlData);
      
      // OpenAI File API를 사용하여 업로드
      const file = await this.openai.files.create({
        file: fs.createReadStream(tempFilePath),
        purpose: "assistants"
      });
      
      // 파일이 업로드된 후 임시 파일 삭제
      fs.unlinkSync(tempFilePath);
      
      this.logger.log(`채용 데이터를 Vector Store에 업로드 완료: ${file.id}`, 'success');
      
      // 어시스턴트가 있으면 파일 연결
      if (this.assistantId) {
        // "file_search" 도구만 활성화
        await this.openai.beta.assistants.update(
          this.assistantId,
          { tools: [{ type: "file_search" }] }
        );
        this.logger.log(`파일 업로드 완료 (ID: ${file.id}), 어시스턴트 업데이트 완료`, 'success');
      }
      
      return file.id;
    } catch (error) {
      this.logger.log(`Vector Store 업로드 실패: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * 파일 ID를 사용하여 검색 관련 메시지 전송
   */
  public async searchJobsWithQuery(
    query: string, 
    fileId: string, 
    threadId?: string
  ): Promise<any> {
    try {
      // 스레드 ID 확인
      if (!this.threadId && !threadId) {
        await this.createThread();
      } else if (threadId && threadId !== this.threadId) {
        this.threadId = threadId;
      }

      if (!this.threadId) {
        throw new Error('스레드가 초기화되지 않았습니다.');
      }

      // 검색 쿼리 메시지 전송
      await this.openai.beta.threads.messages.create(
        this.threadId,
        {
          role: "user",
          content: `# 검색 쿼리\n\n${query}\n\n참조할 파일: ${fileId}`
        }
      );

      // 요청 실행
      const run = await this.openai.beta.threads.runs.create(
        this.threadId,
        { assistant_id: this.assistantId! }
      );

      // 요청 완료 대기
      return await this.waitForRunCompletion(this.threadId, run.id);
    } catch (error) {
      this.logger.log(`Vector Store 검색 실패: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * 실행 완료 대기 및 결과 반환
   */
  private async waitForRunCompletion(threadId: string, runId: string, maxRetries = 60): Promise<any> {
    let retriesLeft = maxRetries;
    
    while (retriesLeft > 0) {
      const runStatus = await this.openai.beta.threads.runs.retrieve(threadId, runId);
      
      if (runStatus.status === 'completed') {
        // 응답 메시지 가져오기
        const messages = await this.openai.beta.threads.messages.list(threadId);
        const assistantMessages = messages.data.filter(msg => msg.role === 'assistant');
        
        if (assistantMessages.length > 0) {
          const latestMessage = assistantMessages[0];
          let content = '';
          
          // 메시지 내용 추출
          if (typeof latestMessage.content === 'string') {
            content = latestMessage.content;
          } else {
            for (const part of latestMessage.content) {
              if (part.type === 'text') {
                content += part.text.value;
              }
            }
          }
          
          try {
            // 결과가 JSON 형식인지 확인
            return this.extractJsonFromResponse(content);
          } catch (error) {
            this.logger.log(`JSON 파싱 오류: ${error}`, 'error');
            return content;
          }
        }
        
        return null;
      } 
      else if (runStatus.status === 'failed' || runStatus.status === 'cancelled') {
        throw new Error(`실행 실패: ${runStatus.status}`);
      }
      
      // 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, 1000));
      retriesLeft--;
    }
    
    throw new Error('최대 대기 시간 초과');
  }

  /**
   * 응답에서 JSON 추출
   */
  private extractJsonFromResponse(text: string): any {
    // JSON 형식을 찾기 위한 정규식 
    const jsonRegex = /\[[\s\S]*\]/;
    const match = text.match(jsonRegex);
    
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (error) {
        this.logger.log(`JSON 파싱 오류: ${error}`, 'error');
      }
    }
    
    // 일반 응답 반환
    return text;
  }
}
