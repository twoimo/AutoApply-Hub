import { Mistral } from '@mistralai/mistralai';
import path from 'path';
import { LoggerService } from '../logging/LoggerService';
import { JobInfo } from '../types/JobTypes';
import { FileHelper } from '../helpers/FileHelper';
import { PathConstants, MistralAIConstants } from '../constants/AppConstants';
import { getSystemInstructions } from './SystemInstructions';
import { sleep } from "@qillie/wheel-micro-service";

/**
 * Mistral 메시지 타입 정의
 */
interface MistralSystemMessage {
  role: 'system';
  content: string;
}

interface MistralUserMessage {
  role: 'user';
  content: string;
}

interface MistralAssistantMessage {
  role: 'assistant';
  content: string;
}

type MistralMessage = MistralSystemMessage | MistralUserMessage | MistralAssistantMessage;

/**
 * Mistral AI API와 상호작용하는 서비스
 */
export class MistralAIService {
  private mistralClient: Mistral | null = null;
  private logger: LoggerService;
  private apiKey: string;
  private readonly systemInstructions: string;
  private readonly persistFilePath: string;
  private chatHistory: MistralMessage[] = [];

  constructor(apiKey: string, logger: LoggerService) {
    this.apiKey = apiKey;
    this.logger = logger;
    this.systemInstructions = getSystemInstructions();
    
    // ID 저장 파일 경로 설정
    this.persistFilePath = path.join(__dirname, '../../../data', PathConstants.MISTRAL_PERSIST_FILE);
    
    this.initializeClient();
  }

  /**
   * Mistral API 클라이언트 초기화
   */
  private initializeClient(): void {
    if (this.apiKey) {
      try {
        this.mistralClient = new Mistral({ apiKey: this.apiKey });
        this.logger.log('Mistral AI API 클라이언트 초기화 완료', 'success');
      } catch (error) {
        this.logger.log(`Mistral AI API 클라이언트 초기화 실패: ${error}`, 'error');
        this.mistralClient = null;
      }
    } else {
      this.logger.log('Mistral API 키가 제공되지 않았습니다', 'warning');
    }
  }

  /**
   * 채팅 기록 초기화
   */
  public async initializeChat(): Promise<void> {
    try {
      // 시스템 지시사항으로 채팅 기록 초기화
      this.chatHistory = [
        { role: "system", content: this.systemInstructions }
      ];
      
      this.logger.log('채팅 기록이 초기화되었습니다', 'success');
    } catch (error) {
      this.logger.log(`채팅 기록 초기화 실패: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * 채팅 메시지 전송
   */
  private async sendMessage(content: string, role: string = MistralAIConstants.ROLES.USER): Promise<string> {
    if (!this.mistralClient) {
      throw new Error('Mistral API 클라이언트가 초기화되지 않았습니다');
    }

    // 채팅 기록이 없으면 초기화
    if (this.chatHistory.length === 0) {
      await this.initializeChat();
    }

    // 메시지 추가
    if (role === 'user') {
      this.chatHistory.push({ role: 'user', content });
    } else if (role === 'system') {
      this.chatHistory.push({ role: 'system', content });
    }

    const maxRetries = 3;
    let retryCount = 0;
    let backoffTime = 2000; // 시작 대기 시간 2초

    while (retryCount <= maxRetries) {
      try {
        if (retryCount > 0) {
          this.logger.log(`Mistral API 요청 재시도 중... (${retryCount}/${maxRetries})`, 'warning');
        }

        // API 호출
        const response = await this.mistralClient.chat.complete({
          model: MistralAIConstants.MODEL.CHAT,
          messages: this.chatHistory,
          temperature: MistralAIConstants.TEMPERATURE,
          maxTokens: MistralAIConstants.MAX_TOKENS
        });

        // 응답 처리
        const messageContent = response?.choices?.[0]?.message?.content;
        let responseContent = '';
        
        // 응답이 문자열이거나 배열일 수 있음
        if (typeof messageContent === 'string') {
          responseContent = messageContent;
        } else if (Array.isArray(messageContent)) {
          responseContent = messageContent.map(chunk => 
            typeof chunk === 'string' ? chunk : ''
          ).join('');
        }
        
        // 응답 메시지 기록에 추가
        if (responseContent) {
          this.chatHistory.push({ 
            role: 'assistant', 
            content: responseContent 
          });
        }

        return responseContent;
      } catch (error: any) {
        if (this.isRateLimitError(error)) {
          if (retryCount < maxRetries) {
            this.logger.log(`속도 제한으로 인한 오류, ${backoffTime/1000}초 후 재시도...`, 'warning');
            await sleep(backoffTime);
            backoffTime *= 2; // 지수 백오프
            retryCount++;
          } else {
            this.logger.log(`최대 재시도 횟수(${maxRetries})에 도달. 요청 실패`, 'error');
            throw error;
          }
        } else {
          this.logger.log('Mistral AI 요청 중 오류: ' + error, 'error');
          throw error;
        }
      }
    }

    throw new Error('최대 재시도 횟수 초과');
  }

  /**
   * 속도 제한 오류인지 확인
   */
  private isRateLimitError(error: any): boolean {
    return error.statusCode === 429 || 
           (error.message && error.message.includes("rate limit"));
  }

  /**
   * 구직자 프로필 및 채용공고 정보로 매칭 수행
   */
  public async matchJobsWithProfile(
    jobs: JobInfo[],
    candidateProfile: string
  ): Promise<any> {
    try {
      // 새로운 채팅 세션 시작
      await this.initializeChat();

      // 구직자 프로필 메시지 전송
      const profilePrompt = `${MistralAIConstants.MESSAGE_PREFIXES.PROFILE}${candidateProfile}`;
      await this.sendMessage(profilePrompt);

      // 채용공고 데이터 전송
      const jobsData = JSON.stringify(jobs, null, 2);
      const jobsPrompt = `${MistralAIConstants.MESSAGE_PREFIXES.JOBS_LIST}${jobsData}`;
      const response = await this.sendMessage(jobsPrompt);

      // JSON 파싱 시도
      try {
        return this.extractJsonFromResponse(response);
      } catch (parseError) {
        this.logger.log(`JSON 파싱 실패: ${parseError}. 원본 텍스트 반환`, 'warning');
        return response;
      }
    } catch (error) {
      this.logger.log(`채용공고 매칭 중 오류: ${error}`, 'error');
      throw error;
    }
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
   * 검색 쿼리로 채용공고 검색
   */
  public async searchJobsWithQuery(
    query: string,
    jobs: JobInfo[]
  ): Promise<any> {
    try {
      // 새로운 채팅 세션 시작
      await this.initializeChat();

      // 구직자 프로필(또는 검색 쿼리) 메시지 전송
      const searchPrompt = `${MistralAIConstants.MESSAGE_PREFIXES.SEARCH_QUERY}${query}`;
      await this.sendMessage(searchPrompt);

      // 채용공고 데이터 전송
      const jobsData = JSON.stringify(jobs, null, 2);
      const jobsPrompt = `${MistralAIConstants.MESSAGE_PREFIXES.JOBS_LIST}${jobsData}`;
      const response = await this.sendMessage(jobsPrompt);

      // JSON 파싱 시도
      try {
        return this.extractJsonFromResponse(response);
      } catch (parseError) {
        this.logger.log(`JSON 파싱 실패: ${parseError}. 원본 텍스트 반환`, 'warning');
        return response;
      }
    } catch (error) {
      this.logger.log(`채용공고 검색 중 오류: ${error}`, 'error');
      throw error;
    }
  }
}
