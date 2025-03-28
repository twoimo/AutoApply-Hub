/**
 * 애플리케이션 상수를 관리하는 파일
 */

/**
 * OpenAI 관련 상수
 */
export const OpenAIConstants = {
  ASSISTANT: {
    MODEL: 'gpt-4o',
    NAME: '채용정보 매칭 어시스턴트',
    DESCRIPTION: '구직자 프로필과 채용공고 간의 적합성을 평가',
    TOOLS: [
      { 
        type: 'retrieval' as const, // 변경: 'function' -> 'retrieval' (검색 도구)
        // name과 function 필드는 retrieval 타입에서 필요하지 않음
      }
    ]
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
  ROLES: {
    USER: 'user' as const,
    ASSISTANT: 'assistant' as const
  },
  FILE_PURPOSE: 'assistants' as const,
  MESSAGE_PREFIXES: {
    PROFILE: '# 구직자 프로필\n\n',
    JOBS_LIST: '# 평가할 채용공고 목록\n\n',
    SEARCH_QUERY: '# 검색 쿼리\n\n'
  }
};

/**
 * 파일 경로 관련 상수
 */
export const PathConstants = {
  DATA_DIR: 'data',
  TEMP_DIR: 'temp',
  OPENAI_PERSIST_FILE: 'openai-persist.json'
};

/**
 * 로깅 관련 상수
 */
export const LoggingConstants = {
  LEVELS: {
    DEBUG: 'debug',
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
  },
  PRIORITY: {
    'debug': 0,
    'info': 1,
    'success': 2,
    'warning': 3,
    'error': 4
  },
  DEFAULT_LEVEL: 'info'
};

/**
 * 채용 매칭 관련 상수
 */
export const JobMatchingConstants = {
  // 적극 지원 권장 점수 기준
  STRONGLY_RECOMMEND_SCORE: 85,
  // 지원 권장 점수 기준
  RECOMMEND_SCORE: 70,
  // 검토 후 지원 점수 기준
  CONSIDER_SCORE: 55,
  // 기본 채용공고 조회 개수
  DEFAULT_JOB_LIMIT: 10,
  // 기본 매칭 결과 개수
  DEFAULT_MATCH_LIMIT: 5
};
