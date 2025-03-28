import OpenAI from 'openai';
import path from 'path';
import { LoggerService } from '../logging/LoggerService';
import { JobInfo } from '../types/JobTypes';
import { FileHelper } from '../helpers/FileHelper';
import { PathConstants, MistralAIConstants } from '../constants/AppConstants';
import { getSystemInstructions } from './SystemInstructions';

// 기존 OpenAI 상수 대체
const OpenAIConstants = {
  ASSISTANT: {
    MODEL: 'gpt-4o',
    NAME: '채용정보 매칭 어시스턴트',
    DESCRIPTION: '구직자 프로필과 채용공고 간의 적합성을 평가',
    TOOLS: [{ type: 'retrieval' as const }]
  },
  RUN: {
    MAX_RETRIES: 60,
    DELAY_MS: 1000,
    STATUS: {
      COMPLETED: 'completed',
      FAILED: 'failed',
      CANCELLED: 'cancelled',
      REQUIRES_ACTION: 'requires_action'
    }
  },
  ROLES: MistralAIConstants.ROLES,
  FILE_PURPOSE: 'assistants' as const,
  MESSAGE_PREFIXES: MistralAIConstants.MESSAGE_PREFIXES
};

// Assistant와 Thread ID를 저장하기 위한 인터페이스
interface PersistentIDs {
  assistantId: string | null;
  threadId: string | null;
}

/**
 * OpenAI API와 상호작용하고 Assistant 기능을 활용하는 서비스
 * @deprecated 이 서비스는 MistralAIService로 대체되었습니다.
 */
export class OpenAIAssistantService {
  private openai: OpenAI;
  private logger: LoggerService;
  private assistantId: string | null = null;
  private threadId: string | null = null;
  private apiKey: string;
  private readonly systemInstructions: string;
  private readonly persistFilePath: string;

  constructor(apiKey: string, logger: LoggerService) {
    this.apiKey = apiKey;
    this.logger = logger;
    this.openai = new OpenAI({
      apiKey: this.apiKey
    });

    // 시스템 지시사항 로드
    this.systemInstructions = getSystemInstructions();
    
    // ID 저장 파일 경로 설정
    this.persistFilePath = path.join(__dirname, '../../../data', PathConstants.OPENAI_PERSIST_FILE);
    
    // 저장된 ID가 있으면 로드
    this.loadPersistedIds();
  }

  /**
   * 저장된 어시스턴트와 스레드 ID 로드
   */
  private loadPersistedIds(): void {
    try {
      // data 디렉토리 확인
      const dataDir = path.dirname(this.persistFilePath);
      FileHelper.ensureDirectoryExists(dataDir);

      // 파일에서 데이터 로드
      const persistedIds = FileHelper.loadJsonFromFile<PersistentIDs>(
        this.persistFilePath, 
        { assistantId: null, threadId: null },
        this.logger
      );
      
      this.assistantId = persistedIds.assistantId;
      this.threadId = persistedIds.threadId;
      
      if (this.assistantId) {
        this.logger.log(`저장된 어시스턴트 ID 로드: ${this.assistantId}`, 'info');
      }
      if (this.threadId) {
        this.logger.log(`저장된 스레드 ID 로드: ${this.threadId}`, 'info');
      }
    } catch (error) {
      this.logger.log(`저장된 ID 로드 실패: ${error}`, 'error');
      // 로드 실패 시 null 값 유지
      this.assistantId = null;
      this.threadId = null;
    }
  }

  /**
   * 어시스턴트와 스레드 ID 저장
   */
  private savePersistedIds(): void {
    const persistedIds: PersistentIDs = {
      assistantId: this.assistantId,
      threadId: this.threadId
    };
    
    const success = FileHelper.saveJsonToFile(
      this.persistFilePath, 
      persistedIds, 
      this.logger
    );
    
    if (!success) {
      this.logger.log('어시스턴트와 스레드 ID 저장 실패', 'error');
    }
  }

  /**
   * OpenAI Assistant 생성 또는 기존 어시스턴트 사용
   */
  public async initializeAssistant(assistantId?: string): Promise<string> {
    try {
      // 이미 어시스턴트가 존재하면 재사용
      if (this.assistantId) {
        this.logger.log(`이미 생성된 어시스턴트 사용: ${this.assistantId}`, 'info');
        return this.assistantId;
      }
      
      if (assistantId) {
        this.assistantId = assistantId;
        this.savePersistedIds(); // ID 저장
        this.logger.log(`기존 어시스턴트 사용: ${this.assistantId}`, 'info');
        return this.assistantId;
      }

      // 새 어시스턴트 생성
      const assistant = await this.openai.beta.assistants.create({
        name: OpenAIConstants.ASSISTANT.NAME,
        description: OpenAIConstants.ASSISTANT.DESCRIPTION,
        model: OpenAIConstants.ASSISTANT.MODEL,
        instructions: this.systemInstructions,
        tools: OpenAIConstants.ASSISTANT.TOOLS as any // 타입 캐스팅으로 임시 해결
      });
      
      this.assistantId = assistant.id;
      this.savePersistedIds(); // ID 저장
      this.logger.log(`어시스턴트 생성 완료: ${this.assistantId}`, 'success');
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
    try {
      // 이미 스레드가 존재하면 재사용
      if (this.threadId) {
        this.logger.log(`기존 스레드 사용: ${this.threadId}`, 'info');
        return this.threadId;
      }

      // 새 스레드 생성
      const thread = await this.openai.beta.threads.create();
      this.threadId = thread.id;
      this.savePersistedIds(); // ID 저장
      this.logger.log(`스레드 생성 완료: ${this.threadId}`, 'success');
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
          role: OpenAIConstants.ROLES.USER,
          content: `# 구직자 프로필\n\n${candidateProfile}`
        }
      );

      // 채용공고 데이터 전송
      const jobsData = JSON.stringify(jobs, null, 2);
      await this.openai.beta.threads.messages.create(
        this.threadId,
        {
          role: OpenAIConstants.ROLES.USER,
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
      // JSONL 형식으로 변환 (각 라인이 독립적인 JSON 객체)
      const jsonlData = jobs.map(job => JSON.stringify(job)).join('\n');
      
      // 임시 파일 생성
      const tempFileName = `jobs_${Date.now()}.jsonl`;
      const tempFilePath = FileHelper.createTempFile(
        tempFileName,
        jsonlData, 
        PathConstants.TEMP_DIR
      );
      
      try {
        // OpenAI File API를 사용하여 업로드
        const file = await this.openai.files.create({
          file: FileHelper.createReadStream(tempFilePath),
          purpose: OpenAIConstants.FILE_PURPOSE
        });
        
        this.logger.log(`채용 데이터를 Vector Store에 업로드 완료: ${file.id}`, 'success');
        
        // 어시스턴트가 있으면 파일 연결
        if (this.assistantId) {
          await this.openai.beta.assistants.update(
            this.assistantId,
            { tools: OpenAIConstants.ASSISTANT.TOOLS as any } // 타입 캐스팅으로 임시 해결
          );
          this.logger.log(`파일 업로드 완료 (ID: ${file.id}), 어시스턴트 업데이트 완료`, 'success');
        }
        
        return file.id;
      } finally {
        // 파일이 업로드된 후 임시 파일 삭제 (성공/실패 여부와 관계없이)
        FileHelper.deleteFile(tempFilePath);
      }
    } catch (error) {
      this.handleError('Vector Store 업로드 실패', error);
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
          role: OpenAIConstants.ROLES.USER,
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
  private async waitForRunCompletion(
    threadId: string, 
    runId: string, 
    maxRetries = OpenAIConstants.RUN.MAX_RETRIES, 
    delayMs = OpenAIConstants.RUN.DELAY_MS
  ): Promise<any> {
    let retriesLeft = maxRetries;
    
    while (retriesLeft > 0) {
      try {
        const runStatus = await this.openai.beta.threads.runs.retrieve(threadId, runId);
        
        this.logger.log(`실행 상태: ${runStatus.status}`, 'debug');
        
        if (runStatus.status === OpenAIConstants.RUN.STATUS.COMPLETED) {
          // 응답 메시지 가져오기
          const messages = await this.openai.beta.threads.messages.list(threadId);
          const assistantMessages = messages.data.filter(msg => 
            msg.role === OpenAIConstants.ROLES.ASSISTANT
          );
          
          if (assistantMessages.length === 0) {
            throw new Error('어시스턴트 응답 메시지가 없습니다.');
          }
          
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
            this.logger.log(`JSON 파싱 오류, 원본 텍스트 반환: ${error}`, 'warning');
            return content;
          }
        } 
        else if (runStatus.status === OpenAIConstants.RUN.STATUS.FAILED) {
          const errorMessage = runStatus.last_error ? 
            `실행 실패: ${runStatus.last_error.code} - ${runStatus.last_error.message}` : 
            '실행 실패: 알 수 없는 오류';
          throw new Error(errorMessage);
        }
        else if (runStatus.status === OpenAIConstants.RUN.STATUS.CANCELLED) {
          throw new Error('실행이 취소되었습니다.');
        }
        else if (runStatus.status === OpenAIConstants.RUN.STATUS.REQUIRES_ACTION) {
          // 필요한 경우 추가 작업 처리 로직 구현
          this.logger.log('실행에 추가 작업이 필요합니다.', 'warning');
        }
        
        // 대기 후 재시도
        await new Promise(resolve => setTimeout(resolve, delayMs));
        retriesLeft--;
        
        // 남은 재시도 횟수가 적을 때 로그 표시
        if (retriesLeft <= 10) {
          this.logger.log(`실행 완료 대기 중... 남은 재시도: ${retriesLeft}`, 'info');
        }
      } catch (error) {
        // OpenAI API 오류 처리 (일시적인 오류인 경우 재시도)
        if (error instanceof Error && (error.message.includes('429') || error.message.includes('500'))) {
          this.logger.log(`API 오류 발생, 잠시 후 재시도: ${error.message}`, 'warning');
          await new Promise(resolve => setTimeout(resolve, delayMs * 2)); // 더 긴 딜레이로 재시도
          retriesLeft--;
        } else {
          // 일시적이지 않은 오류는 즉시 예외 전파
          throw error;
        }
      }
    }
    
    throw new Error(`최대 대기 시간(${maxRetries * delayMs / 1000}초) 초과됨`);
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
      } catch (parseError) {
        this.logger.log(`JSON 파싱 실패: ${parseError}`, 'error');
        throw new Error(`응답에서 유효한 JSON을 추출할 수 없습니다: ${parseError}`);
      }
    }
    
    // JSON이 아닌 경우 원본 텍스트 반환
    return text;
  }

  /**
   * 에러를 표준화된 방식으로 처리
   */
  private handleError(message: string, error: any): never {
    this.logger.log(`${message}: ${error}`, 'error');
    throw error instanceof Error ? error : new Error(`${message}: ${error}`);
  }
}

// fs 모듈 가져오기 (createReadStream 위해 필요)
import fs from 'fs';
