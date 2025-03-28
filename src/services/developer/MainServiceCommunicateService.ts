import { MicroServiceABC, sleep } from "@qillie/wheel-micro-service";
import ApiCallService from "./ApiCallService";
import DataConverterService from "./DataConverterService";
import axios from "axios";
import moment from "moment";
import sequelize from "sequelize";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import ScraperControlService from "../utils/ScraperControlService";
import puppeteer from "puppeteer";
import { JobMatchingService, JobMatchResult } from "../utils/ai/JobMatchingService";
import { LoggerService } from "../utils/logging/LoggerService";
import { JobRepository } from "../utils/db/JobRepository";
import dotenv from 'dotenv';
import { OpenAIAssistantService } from "../utils/ai/OpenAIAssistantService";

// 환경 변수 로드
dotenv.config();

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
  private scraperControlService = new ScraperControlService();
  
  /**
   * 채용공고 매칭 서비스 관련 변수
   */
  private matchingService: JobMatchingService | null = null;
  private logger: LoggerService;
  private jobRepository: JobRepository;
  private openAIAssistantService: OpenAIAssistantService;
  
  // OpenAI API 키 및 어시스턴트 ID
  private readonly openaiApiKey: string = process.env.OPENAI_API_KEY ?? "";
  private readonly assistantId: string = process.env.OPENAI_ASSISTANT_ID ?? "";

  constructor() {
    super([]);
    this.logger = new LoggerService(true);
    this.jobRepository = new JobRepository(this.logger);
    this.openAIAssistantService = new OpenAIAssistantService(this.openaiApiKey, this.logger);
    this.initializeMatchingService();
  }

  /**
   * 매칭 서비스 초기화
   */
  private async initializeMatchingService(): Promise<void> {
    try {
      this.matchingService = new JobMatchingService(
        this.logger,
        this.openaiApiKey,
        this.jobRepository,
        this.assistantId
      );
      
      // 서비스 초기화
      await this.matchingService.initialize();
      this.logger.log('채용공고 매칭 서비스 초기화 완료', 'success');
    } catch (error) {
      this.logger.log(`채용공고 매칭 서비스 초기화 실패: ${error}`, 'error');
    }
  }

  /**
   * @name 테스트
   * @httpMethod get
   * @path /test
   */
  public async test({}: {}) {
    await this.scraperControlService.openSaramin({});
  }

  /**
   * @name 시작 함수
   * @httpMethod get
   * @path /run
   */
  public async run({}: {}) {
    await this.scraperControlService.scheduleWeekdayScraping();
  }
  
  /**
   * @name 채용공고 매칭 실행
   * @httpMethod get
   * @path /match-jobs
   * @objectParams {number} limit - 가져올 채용공고 수 (기본값: 10)
   * @objectParams {number} matchLimit - 결과로 반환할 최대 매칭 수 (기본값: 5)
   */
  public async matchJobs({
    limit = 10,
    matchLimit = 5
  }: {
    limit?: number;
    matchLimit?: number;
  }): Promise<{
    success: boolean;
    results?: JobMatchResult[];
    message?: string;
  }> {
    try {
      if (!this.matchingService) {
        await this.initializeMatchingService();
      }
      
      if (!this.matchingService) {
        throw new Error('매칭 서비스가 초기화되지 않았습니다');
      }
      
      this.logger.log(`채용공고 매칭 시작 (최대 ${limit}개 중 상위 ${matchLimit}개 결과)`, 'info');
      
      // 매칭 실행
      const results = await this.matchingService.matchJobsFromDb(limit, matchLimit);
      
      // 결과 저장
      if (results.length > 0) {
        await this.matchingService.saveMatchResults(results);
      }
      
      return {
        success: true,
        results
      };
    } catch (error) {
      this.logger.log(`채용공고 매칭 API 오류: ${error}`, 'error');
      return {
        success: false,
        message: `채용공고 매칭 중 오류가 발생했습니다: ${error}`
      };
    }
  }
  
  /**
   * @name 추천 채용공고 조회
   * @httpMethod get
   * @path /recommended-jobs
   * @objectParams {number} limit - 반환할 추천 채용공고 수 (기본값: 5)
   */
  public async getRecommendedJobs({
    limit = 5
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
      
      return {
        success: true,
        results: recommendedJobs
      };
    } catch (error) {
      this.logger.log(`추천 채용공고 가져오기 오류: ${error}`, 'error');
      return {
        success: false,
        message: `추천 채용공고를 가져오는 중 오류가 발생했습니다: ${error}`
      };
    }
  }

  /**
   * @name DB 데이터 기반 매칭
   * @httpMethod get
   * @path /match-jobs-vector
   */
  public async matchJobsWithVectorStore({}: {}) {
    // 가정: JobRepository가 모든 테이블 데이터를 반환하는 함수를 제공
    const dbData = await this.jobRepository.getAllTablesData();
    const result = await this.openAIAssistantService.matchJobsWithVectorStore(dbData);
    return { success: true, result };
  }
}
