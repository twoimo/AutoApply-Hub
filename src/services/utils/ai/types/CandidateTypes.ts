/**
 * 구직자 프로필 - 교육 정보
 */
export interface Education {
  degree: string;
  major: string;
  school: string;
  period: string;
}

/**
 * 구직자 프로필 - 경력 정보
 */
export interface Experience {
  role: string;
  company: string;
  period: string;
  description: string;
}

/**
 * 구직자 프로필 - 기술 스택
 */
export interface Skills {
  ai_ml: string[];
  web_dev: string[];
  data_analysis: string[];
  others: string[];
}

/**
 * 구직자 프로필 - 프로젝트 경험
 */
export interface Project {
  title: string;
  tech: string;
  description?: string;
}

/**
 * 구직자 프로필 - 선호 사항
 */
export interface Preferences {
  fields: string[];
  company_size: string;
  industries: string[];
  location: string;
}

/**
 * 구직자 프로필 전체 데이터
 */
export interface CandidateProfile {
  name: string;
  education: Education[];
  experience: Experience[];
  skills: Skills;
  projects: Project[];
  preferences: Preferences;
}
