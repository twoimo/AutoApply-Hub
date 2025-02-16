// 필요한 패키지와 서비스들을 임포트
import { MicroServiceABC, sleep } from "@qillie/wheel-micro-service";
import ApiCallService from "./ApiCallService";
import DataConverterService from "./DataConverterService";
import axios from "axios"; // HTTP 클라이언트 라이브러리
import moment from "moment"; // 날짜 처리 라이브러리
import sequelize from "sequelize"; // ORM 라이브러리
import fs from "fs"; // 파일 시스템 모듈
import path from "path"; // 경로 처리 모듈
import { v4 as uuidv4 } from "uuid"; // UUID 생성 라이브러리
import ScraperControlService from "../utils/ScraperControlService";
import puppeteer from "puppeteer"; // 웹 스크래핑 라이브러리

/**
 * @name 메인 서비스 노출 클래스
 * @domain main_service_communicate
 * 메인 서비스와의 통신을 담당하는 클래스입니다.
 */
export default class MainServiceCommunicateService extends MicroServiceABC {
  /**
   * API 호출 서비스
   * 외부 API 호출을 처리하는 서비스 인스턴스
   */
  private apiCallService = new ApiCallService([]);

  /**
   * 데이터 컨버터 서비스
   * 데이터 변환을 처리하는 서비스 인스턴스
   */
  private dataConverterService = new DataConverterService([]);

  /**
   * 스크래퍼 컨트롤 서비스
   * 웹 스크래핑 작업을 제어하는 서비스 인스턴스
   */
  private ScraperControlService = new ScraperControlService([]);

  /**
   * @name 테스트 메서드
   * @httpMethod get
   * @path /test
   * 테스트 목적으로 사용되는 엔드포인트입니다.
   */
  public async test({}: {}) {
    // 테스트 로직 구현 예정
  }

  /**
   * @name 실행 메서드
   * @httpMethod get
   * @path /run
   * 사람인 웹사이트 스크래핑을 시작하는 엔드포인트입니다.
   */
  public async run({}: {}) {
    await this.ScraperControlService.openSaramin({}); // 사람인 스크래핑 실행
  }
}
