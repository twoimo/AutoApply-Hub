/**
 * 학력 정보 인터페이스
 */
export interface Education {
  degree: string;
  major: string;
  school: string;
  period: string;
}

/**
 * 경력 정보 인터페이스
 */
export interface Experience {
  role: string;
  company: string;
  period: string;
  description: string;
}

/**
 * 프로젝트 정보 인터페이스
 */
export interface Project {
  title: string;
  tech: string;
}

/**
 * 기술 스택 인터페이스
 */
export interface Skills {
  ai_ml: string[];
  web_dev: string[];
  data_analysis: string[];
  others: string[];
}

/**
 * 선호 사항 인터페이스
 */
export interface Preferences {
  fields: string[];
  company_size: string;
  industries: string[];
  location: string;
}

/**
 * 구직자 프로필 전체 인터페이스
 */
export interface CandidateProfile {
  name: string;
  education: Education[];
  experience: Experience[];
  skills: Skills;
  projects: Project[];
  preferences: Preferences;
}
