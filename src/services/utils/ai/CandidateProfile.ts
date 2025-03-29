import { CandidateProfile } from './types/CandidateTypes';

/**
 * 최연우 구직자의 기본 프로필 정보
 */
export const getDefaultCandidateProfile = (): CandidateProfile => {
  return {
    name: '최연우',
    education: [
      { degree: '석사', major: '컴퓨터공학', school: '동국대학교', period: '2022.03-2024.02' },
      { degree: '학사', major: '컴퓨터공학', school: '공주대학교', period: '2016.03-2022.02' }
    ],
    experience: [
      { role: '석사 연구원', company: '동국대학교', period: '2022.03-2024.02', description: '낙상 탐지 연구, ST-GCN 모델 활용' }
    ],
    skills: {
      ai_ml: ['PyTorch', 'TensorFlow', 'Keras', 'MMAction2', 'YOLO', 'Transformer'],
      web_dev: ['HTML/CSS', 'JavaScript', 'Vue.js', 'Node.js', 'Flask'],
      data_analysis: ['Pandas', 'NumPy', 'Matplotlib', 'Seaborn'],
      others: ['Unreal Engine', 'Docker', 'Git', 'IDC 서버 운영']
    },
    projects: [
      { title: '낙상 탐지를 위한 합성 데이터 생성', tech: 'ST-GCN, PyTorch' },
      { title: '보안 취약점 분석 및 블록체인 기술 연구', tech: 'Python, 블록체인' },
      { title: '어종 판별 AI 웹 서비스', tech: 'YOLOv11, Flask, Vue.js' },
      { title: 'CCTV 시스템 개발 (AI 이상행동 탐지)', tech: 'OpenCV, PyTorch, Flask' }
    ],
    preferences: {
      fields: ['AI/ML 개발', '컴퓨터 비전', '보안', '웹 서비스 개발', '게임 이상탐지', '게임 보안 기술 지원', 'IDC 서버 운영'],
      company_size: '중견기업 이상',
      industries: ['금융', '방산', '게임', 'AI 관련 기업'],
      location: '경기도 양주시',
      job_type: '정규직'
    }
  };
};

/**
 * 구직자 프로필을 문자열로 포맷팅하는 함수
 */
export const formatCandidateProfile = (profile: CandidateProfile): string => {
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
  profileText += `- 고용형태: ${profile.preferences.job_type}\n`;
  
  return profileText;
};
