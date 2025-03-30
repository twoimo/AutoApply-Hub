# AI 기반 채용 매칭 플랫폼: 풀스택 기술 명세서

## 1. 소개 및 목적

본 PRD(Product Requirements Document)는 채용 정보 스크래핑 및 매칭 서비스를 위한 프론트엔드 애플리케이션 개발 가이드라인을 제공합니다. 기존 백엔드 시스템과 원활하게 통합되어 사용자에게 직관적이고 반응성 높은 인터페이스를 제공하는 것이 목표입니다.

**핵심 목적:**
- 사용자(구직자)가 자신의 프로필에 맞는 채용 정보를 쉽게 탐색할 수 있는 플랫폼 제공
- 백엔드의 스크래핑 및 AI 매칭 기능을 직관적인 UI로 표현
- 최소한의 대기 시간으로 원활한 사용자 경험 제공

## 2. 사용자 페르소나 및 니즈

### 주요 페르소나: 최연우 (구직자)
- **배경:** 컴퓨터공학 석사 학위자, AI/ML 분야 전문가
- **니즈:** 
  - 자신의 기술 스택과 경험에 맞는 채용 공고 탐색
  - 지원 가능성이 높은 공고를 우선적으로 확인
  - 여러 채용 사이트를 개별적으로 방문하는 번거로움 해소

### 페르소나의 여정:
1. 사이트 방문 및 로그인
2. 개인 프로필 설정/확인
3. 추천 채용 공고 확인
4. 채용 공고 상세 정보 탐색
5. 관심 있는 공고 저장
6. 지원 의사결정 및 지원

## 3. 기능 요구사항

### 3.1 사용자 계정 관리
- 회원가입 및 로그인
- 프로필 설정 및 관리 (기술 스택, 경력, 선호 직무/산업 등)
- 비밀번호 재설정 및 계정 보안

### 3.2 대시보드
- 맞춤 추천 채용 공고 요약 표시
- 최근 활동 및 지원 현황
- 신규 공고 알림 표시
- 주요 통계 (지원 현황, 매칭 점수 분포 등)

### 3.3 채용 공고 탐색
- 추천 공고 목록 (매칭 점수별 정렬)
- 고급 필터링 옵션 (회사 규모, 지역, 기술 키워드 등)
- 검색 기능 (키워드, 회사명, 직무명 등)
- 인피니트 스크롤 또는 페이지네이션

### 3.4 채용 공고 상세 페이지
- 회사 정보, 직무 설명, 요구사항, 우대사항 표시
- 매칭 점수 및 매칭 근거 시각화
- 지원자의 강점 및 보완점 강조
- 지원 버튼 및 관심 공고 저장 옵션

### 3.5 자동 지원 관리
- 자동 지원 설정 (선호도, 매칭 점수 임계값 등)
- 자동 지원 이력 확인
- 지원 취소 및 후속 조치 관리

### 3.6 스크래핑 현황 모니터링
- 스크래핑 작업 상태 확인
- 최근 수집된 공고 통계
- 수동 스크래핑 요청 기능

## 4. 비기능 요구사항

### 4.1 성능
- **페이지 로드 시간:** 초기 로드 < 2초, 이후 상호작용 < 0.5초
- **API 응답 처리:** 백엔드 응답 대기 중 로딩 상태 표시, 긴 작업은 백그라운드 처리
- **리소스 최적화:** 이미지 레이지 로딩, 코드 스플리팅, 번들 최소화

### 4.2 사용성
- 모바일 최적화 (반응형 디자인)
- 다크 모드 지원
- 스크린 리더 호환성 (웹 접근성)
- 키보드 탐색 및 단축키 지원

### 4.3 보안
- HTTPS 적용
- XSS 및 CSRF 방어
- 세션 관리 및 안전한 토큰 저장
- 사용자 데이터 보안 처리

### 4.4 확장성
- 국제화(i18n) 프레임워크 적용
- 테마 시스템 구현
- 모듈식 아키텍처로 기능 확장 용이성 확보

## 5. UI/UX 개요

### 5.1 디자인 시스템
- **컬러 팔레트:** 전문적이고 신뢰감을 주는 블루 계열 기본, 액션 버튼은 대비색 사용
- **타이포그래피:** 가독성 높은 산세리프 폰트, 중요도에 따른 계층 구조
- **컴포넌트 라이브러리:** 재사용 가능한 UI 컴포넌트 구성 (버튼, 카드, 폼 요소 등)
- **반응형 그리드:** 모든 디바이스에서 최적화된 레이아웃

### 5.2 주요 화면 구성
1. **로그인/회원가입 화면**
   - 간결한 폼 레이아웃
   - 소셜 로그인 옵션
   - 오류 메시지 인라인 표시

2. **대시보드**
   - 요약 통계 카드
   - 최근 활동 타임라인
   - 빠른 액션 버튼

3. **채용 공고 목록**
   - 그리드/리스트 전환 가능한 뷰
   - 공고별 매칭 점수 시각화
   - 퀵 필터 및 정렬 옵션

4. **공고 상세 페이지**
   - 스티키 헤더(회사명, 직무명, 주요 정보)
   - 구조화된 정보 섹션
   - 매칭 분석 시각화
   - 주요 액션 버튼 강조

5. **프로필 관리**
   - 탭 기반 섹션 구분
   - 인터랙티브 스킬 관리
   - 진행 상태 표시

## 6. 기술 스택 제안

### 6.1 프론트엔드 프레임워크
- **React + Next.js**
  - React: 광범위한 에코시스템, 유연성
  - Next.js: 서버 사이드 렌더링, 정적 생성, 라우팅

### 6.2 상태 관리
- **Redux Toolkit**
  - 비동기 작업 처리에 미들웨어 활용
  - 지연 로딩 지원으로 초기 번들 크기 최소화

### 6.3 UI 라이브러리
- **Tailwind CSS + 커스텀 컴포넌트**
  - 유틸리티 기반 접근으로 최적화된 CSS
  - 자체 디자인 시스템과 결합

### 6.4 성능 최적화 도구
- **Next.js 내장 최적화 + Webpack**
  - 코드 스플리팅
  - 트리 쉐이킹
  - 이미지 최적화

### 6.5 API 통신
- **TanStack Query(React Query)**
  - 캐싱과 요청 중복 제거
  - 자동 재시도 및 로딩/에러 상태 관리
  - 데이터 동기화

### 6.6 개발 환경
- **TypeScript**
  - 타입 안전성으로 버그 감소
  - 개발 생산성 향상
  - IDE 지원 및 문서화 개선

## 7. 아키텍처 설계

### 7.1 컴포넌트 구조
- **아토믹 디자인 패턴 적용**
  - Atoms: 기본 입력 요소, 버튼 등
  - Molecules: 폼 그룹, 카드 등 
  - Organisms: 헤더, 사이드바, 채용 공고 목록 등
  - Templates: 페이지 레이아웃
  - Pages: 라우팅 가능한 최종 화면

### 7.2 데이터 흐름
- **단방향 데이터 흐름 적용**
  - 상태 관리 스토어 → 컴포넌트 → 사용자 액션 → 상태 업데이트

### 7.3 API 통신 레이어
- **API 클라이언트 모듈화**
  - 기능별 API 서비스 분리
  - 인터셉터를 통한 공통 에러 처리
  - 토큰 관리 및 인증 헤더 자동 주입

### 7.4 성능 최적화 전략
- **코드 스플리팅**
  - 라우트 기반 분할
  - 컴포넌트 레이지 로딩
- **메모이제이션**
  - React.memo, useMemo, useCallback 활용
  - 불필요한 리렌더링 방지
- **가상 스크롤링**
  - 대량의 채용 공고 목록 표시 시 활용

## 8. 개발 로드맵

### 8.1 단계별 개발 계획
1. **1단계: 기본 인프라 구축 (2주)**
   - 프로젝트 설정 및 CI/CD 파이프라인
   - 컴포넌트 라이브러리 구축
   - API 클라이언트 구현

2. **2단계: 핵심 기능 개발 (4주)**
   - 인증 시스템
   - 대시보드
   - 채용 공고 목록 및 상세 페이지

3. **3단계: 고급 기능 (3주)**
   - 매칭 시각화
   - 자동 지원 관리
   - 고급 필터링 및 검색

4. **4단계: 최적화 및 테스트 (2주)**
   - 성능 최적화
   - 사용성 테스트
   - 크로스 브라우저 호환성 확인

5. **5단계: 배포 및 모니터링 설정 (1주)**
   - 프로덕션 환경 설정
   - 모니터링 도구 통합
   - 배포 자동화

### 8.2 우선순위 설정
- **P0 (필수):** 인증, 채용 공고 목록/상세, 기본 프로필 관리
- **P1 (중요):** 맞춤 추천, 매칭 시각화, 고급 필터링
- **P2 (추가):** 자동 지원, 알림 시스템, 통계 대시보드

## 9. 성능 최적화 전략

### 9.1 초기 로딩 최적화
- **애플리케이션 셸 아키텍처**
  - 핵심 UI 구조 먼저 로드
  - 데이터 의존적 콘텐츠는 비동기 로드
- **중요 리소스 프리로딩**
  - 주요 스크립트 및 스타일 우선 로드
  - 폰트 최적화 (가변 폰트, font-display 설정)

### 9.2 API 통신 최적화
- **데이터 캐싱 전략**
  - 자주 변경되지 않는 데이터는 장시간 캐싱
  - 사용자별 데이터는 세션 단위 캐싱
- **가상화된 대규모 목록**
  - 스크린에 보이는 항목만 렌더링
  - 채용 공고 목록의 부드러운 스크롤 구현

### 9.3 상호작용 최적화
- **입력 디바운싱 및 스로틀링**
  - 검색어 입력 시 디바운싱 적용
  - 스크롤 이벤트 스로틀링
- **배치 업데이트**
  - 여러 상태 변경을 단일 업데이트로 통합
  - 트랜잭션 기반 상태 업데이트 구현

### 9.4 사용자 체감 성능 개선
- **의미 있는 로딩 상태**
  - 스켈레톤 화면으로 로딩 구현
  - 진행 상태 표시 (작업 예상 시간 제공)
- **낙관적 UI 업데이트**
  - 서버 응답 전 UI 즉시 업데이트
  - 실패 시 롤백 메커니즘 구현

## 10. 성공 지표

### 10.1 성능 지표
- **Lighthouse 점수:** 성능, 접근성, SEO 각 카테고리 90점 이상
- **Core Web Vitals:** LCP < 2.5초, FID < 100ms, CLS < 0.1
- **API 응답 시간:** 백엔드 API 호출 평균 응답 시간 200ms 이하

### 10.2 사용자 지표
- **사용자 이탈률:** 첫 페이지에서 30% 이하
- **세션 지속 시간:** 평균 5분 이상
- **전환율:** 공고 조회에서 지원까지 전환율 10% 이상
- **재방문율:** 주간 재방문 사용자 50% 이상

### 10.3 비즈니스 지표
- **추천 공고 클릭률:** 70% 이상
- **자동 지원 성공률:** 95% 이상
- **매칭 정확도:** 사용자 피드백 기반 85% 이상의 만족도

## 11. 프론트엔드 프로젝트 구조

### 11.1 폴더 구조

프론트엔드 코드는 `frontend` 디렉토리에 별도로 구성하여 백엔드와 명확히 분리합니다:

```
wheel-micro-service-boilerplate-study/
├── src/                    # 백엔드 소스 코드 (기존)
├── docs/                   # 문서 (기존)
└── frontend/               # 프론트엔드 애플리케이션 (Next.js)
    ├── .next/              # Next.js 빌드 출력
    ├── public/             # 정적 파일
    │   ├── images/         # 이미지 에셋
    │   └── fonts/          # 웹 폰트
    ├── app/                # Next.js App Router
    │   ├── layout.tsx      # 루트 레이아웃
    │   ├── page.tsx        # 홈페이지
    │   ├── (auth)/         # 인증 관련 라우트 그룹
    │   │   ├── login/      # 로그인 페이지
    │   │   └── register/   # 회원가입 페이지
    │   ├── dashboard/      # 대시보드 페이지
    │   ├── jobs/           # 채용 공고 목록
    │   │   └── [id]/       # 채용 공고 상세 (동적 라우트)
    │   ├── profile/        # 프로필 관리
    │   └── admin/          # 관리자 기능 (스크래핑 제어 등)
    ├── components/         # 재사용 가능한 컴포넌트
    │   ├── ui/             # 기본 UI 컴포넌트 (아토믹 디자인 패턴)
    │   │   ├── atoms/      # 버튼, 입력 필드 등 기본 요소
    │   │   ├── molecules/  # 폼 그룹, 카드 등 복합 요소
    │   │   └── organisms/  # 헤더, 사이드바 등 복잡한 컴포넌트
    │   ├── auth/           # 인증 관련 컴포넌트
    │   ├── dashboard/      # 대시보드 관련 컴포넌트
    │   ├── jobs/           # 채용 공고 관련 컴포넌트
    │   ├── profile/        # 프로필 관련 컴포넌트
    │   └── admin/          # 관리자 컴포넌트
    ├── lib/                # 유틸리티 및 헬퍼 함수
    │   ├── utils.ts        # 일반 유틸리티 함수
    │   ├── constants.ts    # 상수 정의
    │   └── types.ts        # 타입 정의
    ├── hooks/              # 커스텀 React 훅
    │   ├── useAuth.ts      # 인증 관련 훅
    │   ├── useJobs.ts      # 채용 공고 관련 훅
    │   └── useProfile.ts   # 프로필 관련 훅
    ├── store/              # 상태 관리 (Redux Toolkit)
    │   ├── index.ts        # 스토어 설정
    │   ├── authSlice.ts    # 인증 관련 상태
    │   ├── jobsSlice.ts    # 채용 공고 관련 상태
    │   └── uiSlice.ts      # UI 관련 상태
    ├── services/           # API 통신 서비스
    │   ├── api.ts          # 기본 API 클라이언트 설정
    │   ├── authService.ts  # 인증 관련 API
    │   ├── jobsService.ts  # 채용 공고 관련 API
    │   └── profileService.ts # 프로필 관련 API
    ├── styles/             # 글로벌 스타일
    │   ├── globals.css     # 글로벌 CSS
    │   └── theme.ts        # 테마 설정
    ├── middleware.ts       # Next.js 미들웨어 (인증 등)
    ├── next.config.js      # Next.js 설정
    ├── package.json        # 프론트엔드 의존성
    └── tsconfig.json       # TypeScript 설정
```

### 11.2 주요 기능별 파일명

#### 인증 시스템
- `app/(auth)/login/page.tsx`: 로그인 페이지
- `app/(auth)/register/page.tsx`: 회원가입 페이지
- `components/auth/LoginForm.tsx`: 로그인 폼 컴포넌트
- `components/auth/RegisterForm.tsx`: 회원가입 폼 컴포넌트
- `hooks/useAuth.ts`: 인증 관련 커스텀 훅
- `services/authService.ts`: 인증 API 통신
- `store/authSlice.ts`: 인증 상태 관리

#### 대시보드
- `app/dashboard/page.tsx`: 대시보드 메인 페이지
- `components/dashboard/StatisticCard.tsx`: 통계 카드 컴포넌트
- `components/dashboard/ActivityTimeline.tsx`: 활동 타임라인
- `components/dashboard/RecommendedJobs.tsx`: 추천 채용 공고 미리보기

#### 채용 공고
- `app/jobs/page.tsx`: 채용 공고 목록 페이지
- `app/jobs/[id]/page.tsx`: 채용 공고 상세 페이지
- `components/jobs/JobCard.tsx`: 채용 공고 카드 컴포넌트
- `components/jobs/JobFilters.tsx`: 필터링 컴포넌트
- `components/jobs/MatchScore.tsx`: 매칭 점수 시각화
- `components/jobs/JobDetails.tsx`: 공고 상세 정보
- `hooks/useJobs.ts`: 채용 공고 데이터 관련 훅
- `services/jobsService.ts`: 채용 공고 API 통신

#### 프로필 관리
- `app/profile/page.tsx`: 프로필 관리 페이지
- `components/profile/ProfileForm.tsx`: 프로필 편집 폼
- `components/profile/SkillManager.tsx`: 기술 스택 관리
- `components/profile/ExperienceEditor.tsx`: 경력 정보 편집
- `services/profileService.ts`: 프로필 API 통신

#### 자동 지원 관리
- `app/applications/page.tsx`: 지원 현황 페이지
- `components/applications/ApplicationSettings.tsx`: 자동 지원 설정
- `components/applications/ApplicationHistory.tsx`: 지원 이력
- `services/applicationService.ts`: 지원 관련 API 통신

#### 관리자 기능
- `app/admin/scraper/page.tsx`: 스크래핑 제어 페이지
- `components/admin/ScraperControl.tsx`: 스크래핑 컨트롤 UI
- `components/admin/ScrapingStatus.tsx`: 스크래핑 상태 모니터링
- `services/adminService.ts`: 관리자 기능 API 통신

### 11.3 supabase 데이터베이스 연동

Next.js에서 supabase 데이터베이스 연동은 서버 컴포넌트나 API 라우트에서 처리합니다:

```
frontend/
├── lib/
│   └── db.ts             # 데이터베이스 연결 설정
├── models/               # 데이터 모델 (Prisma 또는 Sequelize)
│   ├── user.ts           # 사용자 모델
│   ├── job.ts            # 채용 공고 모델
│   └── application.ts    # 지원 이력 모델
└── app/api/              # Next.js API 라우트
    ├── auth/             # 인증 관련 API
    ├── jobs/             # 채용 공고 관련 API
    └── profile/          # 프로필 관련 API
```

#### 데이터베이스 연결 예시 (Prisma 사용)
- `prisma/schema.prisma`: Prisma 스키마 정의
- `lib/prisma.ts`: Prisma 클라이언트 인스턴스
- `app/api/jobs/route.ts`: 채용 공고 API 엔드포인트

#### 데이터베이스 연결 예시 (Sequelize 사용)
- `lib/db.ts`: Sequelize 연결 설정
- `models/index.ts`: 모델 초기화 및 관계 설정

이 구조는 Next.js의 App Router 기능을 활용하여 서버 컴포넌트와 클라이언트 컴포넌트를 효과적으로 분리하며, 데이터 페칭을 최적화할 수 있습니다. 또한 Redux Toolkit을 통해 상태 관리를 체계적으로 구현할 수 있습니다.

## 12. 백엔드 API 요구사항

프론트엔드 애플리케이션을 지원하기 위해 기존 백엔드 코드를 확장하여 필요한 API를 구현합니다. 기존 스크래핑 및 매칭 로직을 활용하면서 사용자 관리 및 인증 기능을 추가합니다.

### 12.1 백엔드 폴더 구조 확장

기존 프로젝트 구조를 기반으로 프론트엔드를 지원할 백엔드 코드를 추가합니다:

```
wheel-micro-service-boilerplate-study/
├── src/
│   ├── types/
│   │   ├── jobs.ts                   # 채용 정보 타입 (기존)
│   │   ├── auth.ts                   # 인증 관련 타입 (추가)
│   │   └── users.ts                  # 사용자 관련 타입 (추가)
│   │
│   ├── models/
│   │   ├── main/
│   │   │   ├── CompanyRecruitmentTable.ts   # 채용 공고 모델 (기존)
│   │   │   ├── UserTable.ts          # 사용자 모델 (추가)
│   │   │   ├── UserProfileTable.ts   # 사용자 프로필 모델 (추가)
│   │   │   ├── UserSkillTable.ts     # 사용자 기술 스택 모델 (추가)
│   │   │   ├── UserExperienceTable.ts  # 사용자 경력 모델 (추가)
│   │   │   ├── BookmarkTable.ts      # 북마크 모델 (추가)
│   │   │   └── ApplicationTable.ts   # 지원 이력 모델 (추가)
│   │
│   ├── services/
│   │   ├── utils/
│   │   │   ├── ScraperFactory.ts     # 스크래퍼 팩토리 (기존)
│   │   │   ├── ScraperControlService.ts  # 스크래퍼 제어 (기존)
│   │   │   ├── auth/                 # 인증 관련 유틸리티 (추가)
│   │   │   │   ├── AuthService.ts    # 인증 서비스
│   │   │   │   └── JwtService.ts     # JWT 토큰 관리
│   │   │   │
│   │   │   ├── db/
│   │   │   │   ├── JobRepository.ts  # 채용 정보 저장소 (기존)
│   │   │   │   ├── UserRepository.ts # 사용자 저장소 (추가)
│   │   │   │   └── ApplicationRepository.ts # 지원 이력 저장소 (추가)
│   │   │
│   │   ├── developer/
│   │   │   ├── MainServiceCommunicateService.ts  # 기존 서비스 (확장)
│   │   │   ├── UserService.ts        # 사용자 관리 서비스 (추가)
│   │   │   ├── AuthService.ts        # 인증 서비스 (추가)
│   │   │   ├── JobSearchService.ts   # 채용 공고 검색 서비스 (추가)
│   │   │   ├── ProfileService.ts     # 프로필 관리 서비스 (추가)
│   │   │   └── ApplicationService.ts # 지원 관리 서비스 (추가)
```

### 12.2 백엔드 API 엔드포인트

프론트엔드 애플리케이션에서 필요한 API 엔드포인트는 다음과 같습니다:

#### 12.2.1 인증 API

```typescript
// AuthService.ts
/**
 * 회원가입 API
 * @httpMethod post
 * @path /auth/register
 * @objectParams {string} email - 사용자 이메일
 * @objectParams {string} password - 사용자 비밀번호
 * @objectParams {string} name - 사용자 이름
 */
public async register({ email, password, name }: { email: string, password: string, name: string }): Promise<any>;

/**
 * 로그인 API
 * @httpMethod post
 * @path /auth/login
 * @objectParams {string} email - 사용자 이메일
 * @objectParams {string} password - 사용자 비밀번호
 */
public async login({ email, password }: { email: string, password: string }): Promise<any>;

/**
 * 로그아웃 API
 * @httpMethod post
 * @path /auth/logout
 */
public async logout({}: {}): Promise<any>;

/**
 * 토큰 갱신 API
 * @httpMethod post
 * @path /auth/refresh-token
 * @objectParams {string} refreshToken - 갱신 토큰
 */
public async refreshToken({ refreshToken }: { refreshToken: string }): Promise<any>;
```

#### 12.2.2 사용자 프로필 API

```typescript
// ProfileService.ts
/**
 * 사용자 프로필 조회 API
 * @httpMethod get
 * @path /profile
 */
public async getProfile({}: {}): Promise<any>;

/**
 * 사용자 프로필 업데이트 API
 * @httpMethod put
 * @path /profile
 * @objectParams {string} name - 사용자 이름
 * @objectParams {object} education - 학력 정보
 * @objectParams {array} skills - 기술 스택
 * @objectParams {array} experience - 경력 정보
 * @objectParams {object} preferences - 선호 조건
 */
public async updateProfile({ name, education, skills, experience, preferences }: any): Promise<any>;

/**
 * 기술 스택 추가 API
 * @httpMethod post
 * @path /profile/skills
 * @objectParams {array} skills - 기술 스택 목록
 */
public async addSkills({ skills }: { skills: string[] }): Promise<any>;

/**
 * 경력 정보 추가 API
 * @httpMethod post
 * @path /profile/experience
 * @objectParams {object} experience - 경력 정보
 */
public async addExperience({ experience }: { experience: any }): Promise<any>;
```

#### 12.2.3 채용 공고 API

```typescript
// JobSearchService.ts
/**
 * 추천 채용 공고 조회 API
 * @httpMethod get
 * @path /jobs/recommended
 * @objectParams {number} limit - 조회할 최대 항목 수
 * @objectParams {number} page - 페이지 번호
 */
public async getRecommendedJobs({ limit = 10, page = 1 }: { limit?: number, page?: number }): Promise<any>;

/**
 * 채용 공고 검색 API
 * @httpMethod get
 * @path /jobs/search
 * @objectParams {string} keyword - 검색 키워드
 * @objectParams {object} filters - 필터 조건
 * @objectParams {number} limit - 조회할 최대 항목 수
 * @objectParams {number} page - 페이지 번호
 */
public async searchJobs({ keyword, filters, limit = 10, page = 1 }: { 
  keyword?: string, 
  filters?: any, 
  limit?: number, 
  page?: number 
}): Promise<any>;

/**
 * 채용 공고 상세 조회 API
 * @httpMethod get
 * @path /jobs/:id
 * @objectParams {number} id - 채용 공고 ID
 */
public async getJobDetails({ id }: { id: number }): Promise<any>;

/**
 * 채용 공고 북마크 API
 * @httpMethod post
 * @path /jobs/:id/bookmark
 * @objectParams {number} id - 채용 공고 ID
 */
public async bookmarkJob({ id }: { id: number }): Promise<any>;
```

#### 12.2.4 지원 관리 API

```typescript
// ApplicationService.ts
/**
 * 채용 공고 지원 API
 * @httpMethod post
 * @path /applications
 * @objectParams {number} jobId - 채용 공고 ID
 */
public async applyForJob({ jobId }: { jobId: number }): Promise<any>;

/**
 * 지원 이력 조회 API
 * @httpMethod get
 * @path /applications
 * @objectParams {number} limit - 조회할 최대 항목 수
 * @objectParams {number} page - 페이지 번호
 */
public async getApplicationHistory({ limit = 10, page = 1 }: { limit?: number, page?: number }): Promise<any>;

/**
 * 자동 지원 설정 API
 * @httpMethod post
 * @path /applications/settings
 * @objectParams {number} minScore - 최소 매칭 점수
 * @objectParams {object} preferences - 자동 지원 선호 조건
 */
public async updateAutoApplySettings({ minScore, preferences }: { minScore: number, preferences: any }): Promise<any>;
```

#### 12.2.5 관리자 API (스크래핑 제어)

```typescript
// MainServiceCommunicateService.ts (확장)
/**
 * 스크래핑 수동 실행 API
 * @httpMethod post
 * @path /admin/scraper/run
 * @objectParams {object} config - 스크래퍼 설정
 */
public async runScraper({ config = {} }: { config?: any }): Promise<any>;

/**
 * 스크래핑 상태 조회 API
 * @httpMethod get
 * @path /admin/scraper/status
 */
public async getScraperStatus({}: {}): Promise<any>;

/**
 * 스크래핑 결과 통계 API
 * @httpMethod get
 * @path /admin/scraper/stats
 */
public async getScraperStats({}: {}): Promise<any>;
```

### 12.3 데이터베이스 모델 확장

프론트엔드 기능을 지원하기 위해 기존 데이터베이스 모델을 확장합니다:

#### 12.3.1 사용자 모델 (UserTable)

```typescript
// UserTable.ts
import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database';

class UserTable extends Model {
  public id!: number;
  public email!: string;
  public password!: string;
  public name!: string;
  public role!: string; // 'user' 또는 'admin'
  public isActive!: boolean;
  public lastLoginAt?: Date;
  public createdAt!: Date;
  public updatedAt!: Date;
}

UserTable.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      defaultValue: 'user',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
  }
);

export default UserTable;
```

#### 12.3.2 사용자 프로필 모델 (UserProfileTable)

```typescript
// UserProfileTable.ts
import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database';
import UserTable from './UserTable';

class UserProfileTable extends Model {
  public id!: number;
  public userId!: number;
  public education!: JSON; // 학력 정보 (JSON)
  public preferences!: JSON; // 직무 선호도 (JSON)
  public location!: string; // 거주 지역
  public bio?: string; // 자기소개
  public createdAt!: Date;
  public updatedAt!: Date;
}

UserProfileTable.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: UserTable,
        key: 'id',
      },
    },
    education: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    preferences: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'user_profiles',
    timestamps: true,
  }
);

// 관계 설정
UserTable.hasOne(UserProfileTable, { foreignKey: 'userId' });
UserProfileTable.belongsTo(UserTable, { foreignKey: 'userId' });

export default UserProfileTable;
```

#### 12.3.3 북마크 모델 (BookmarkTable)

```typescript
// BookmarkTable.ts
import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database';
import UserTable from './UserTable';
import CompanyRecruitmentTable from './CompanyRecruitmentTable';

class BookmarkTable extends Model {
  public id!: number;
  public userId!: number;
  public jobId!: number;
  public createdAt!: Date;
  public updatedAt!: Date;
}

BookmarkTable.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: UserTable,
        key: 'id',
      },
    },
    jobId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: CompanyRecruitmentTable,
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'bookmarks',
    timestamps: true,
  }
);

// 관계 설정
UserTable.hasMany(BookmarkTable, { foreignKey: 'userId' });
BookmarkTable.belongsTo(UserTable, { foreignKey: 'userId' });
CompanyRecruitmentTable.hasMany(BookmarkTable, { foreignKey: 'jobId' });
BookmarkTable.belongsTo(CompanyRecruitmentTable, { foreignKey: 'jobId' });

export default BookmarkTable;
```

### 12.4 백엔드 API 구현 예시

#### 12.4.1 인증 서비스 구현 예시

```typescript
// AuthService.ts
import { MicroServiceABC } from "@qillie/wheel-micro-service";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import UserTable from "../../models/main/UserTable";

export default class AuthService extends MicroServiceABC {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private readonly JWT_EXPIRY = '24h';
  private readonly SALT_ROUNDS = 10;

  constructor() {
    super([]);
  }

  /**
   * 회원가입 API
   * @httpMethod post
   * @path /auth/register
   */
  public async register({ email, password, name }: { email: string, password: string, name: string }): Promise<any> {
    try {
      // 이메일 중복 체크
      const existingUser = await UserTable.findOne({ where: { email } });
      if (existingUser) {
        return {
          success: false,
          message: '이미 사용 중인 이메일입니다.'
        };
      }

      // 비밀번호 해싱
      const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

      // 사용자 생성
      const user = await UserTable.create({
        email,
        password: hashedPassword,
        name,
        role: 'user',
        isActive: true
      });

      return {
        success: true,
        message: '회원가입이 완료되었습니다.',
        data: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      };
    } catch (error) {
      return {
        success: false,
        message: '회원가입 중 오류가 발생했습니다.',
        error: error.message
      };
    }
  }

  /**
   * 로그인 API
   * @httpMethod post
   * @path /auth/login
   */
  public async login({ email, password }: { email: string, password: string }): Promise<any> {
    try {
      // 사용자 조회
      const user = await UserTable.findOne({ where: { email } });
      if (!user) {
        return {
          success: false,
          message: '이메일 또는 비밀번호가 일치하지 않습니다.'
        };
      }

      // 비밀번호 확인
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return {
          success: false,
          message: '이메일 또는 비밀번호가 일치하지 않습니다.'
        };
      }

      // 로그인 시간 업데이트
      await user.update({ lastLoginAt: new Date() });

      // JWT 토큰 생성
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        this.JWT_SECRET,
        { expiresIn: this.JWT_EXPIRY }
      );

      return {
        success: true,
        message: '로그인 성공',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        message: '로그인 중 오류가 발생했습니다.',
        error: error.message
      };
    }
  }

  // 다른 인증 메서드들...
}
```

#### 12.4.2 채용 공고 서비스 구현 예시

```typescript
// JobSearchService.ts
import { MicroServiceABC } from "@qillie/wheel-micro-service";
import sequelize from "sequelize";
import CompanyRecruitmentTable from "../../models/main/CompanyRecruitmentTable";
import UserTable from "../../models/main/UserTable";
import BookmarkTable from "../../models/main/BookmarkTable";

export default class JobSearchService extends MicroServiceABC {
  constructor() {
    super([]);
  }

  /**
   * 추천 채용 공고 조회 API
   * @httpMethod get
   * @path /jobs/recommended
   */
  public async getRecommendedJobs({ limit = 10, page = 1, userId }: { 
    limit?: number, 
    page?: number,
    userId: number 
  }): Promise<any> {
    try {
      const offset = (page - 1) * limit;
      
      // 매칭 점수가 높은 순으로 정렬하여 추천 공고 조회
      const jobs = await CompanyRecruitmentTable.findAll({
        where: {
          is_gpt_checked: true,
          is_recommended: true
        },
        attributes: [
          'id', 'company_name', 'job_title', 'job_location', 
          'job_type', 'deadline', 'match_score', 'match_reason', 
          'strength', 'weakness', 'job_url', 'company_type'
        ],
        order: [['match_score', 'DESC']],
        limit,
        offset
      });

      // 북마크 정보 조회
      const jobIds = jobs.map(job => job.id);
      const bookmarks = await BookmarkTable.findAll({
        where: {
          userId,
          jobId: {
            [sequelize.Op.in]: jobIds
          }
        },
        attributes: ['jobId']
      });

      const bookmarkedJobIds = new Set(bookmarks.map(bookmark => bookmark.jobId));

      // 응답 데이터 구성
      const formattedJobs = jobs.map(job => ({
        id: job.id,
        companyName: job.company_name,
        jobTitle: job.job_title,
        location: job.job_location,
        jobType: job.job_type,
        deadline: job.deadline,
        matchScore: job.match_score,
        matchReason: job.match_reason,
        strength: job.strength,
        weakness: job.weakness,
        url: job.job_url,
        companyType: job.company_type,
        isBookmarked: bookmarkedJobIds.has(job.id)
      }));

      // 전체 추천 공고 수 조회
      const totalCount = await CompanyRecruitmentTable.count({
        where: {
          is_gpt_checked: true,
          is_recommended: true
        }
      });

      return {
        success: true,
        data: {
          jobs: formattedJobs,
          pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        message: '추천 채용 공고 조회 중 오류가 발생했습니다.',
        error: error.message
      };
    }
  }

  /**
   * 채용 공고 상세 조회 API
   * @httpMethod get
   * @path /jobs/:id
   */
  public async getJobDetails({ id, userId }: { id: number, userId: number }): Promise<any> {
    try {
      // 채용 공고 상세 정보 조회
      const job = await CompanyRecruitmentTable.findByPk(id);
      
      if (!job) {
        return {
          success: false,
          message: '해당 채용 공고를 찾을 수 없습니다.'
        };
      }

      // 북마크 상태 확인
      const bookmark = await BookmarkTable.findOne({
        where: { userId, jobId: id }
      });

      // 응답 데이터 구성
      const jobDetails = {
        id: job.id,
        companyName: job.company_name,
        jobTitle: job.job_title,
        location: job.job_location,
        jobType: job.job_type,
        jobSalary: job.job_salary,
        deadline: job.deadline,
        employmentType: job.employment_type,
        companyType: job.company_type,
        jobDescription: job.job_description,
        matchScore: job.match_score,
        matchReason: job.match_reason,
        strength: job.strength,
        weakness: job.weakness,
        url: job.job_url,
        isRecommended: job.is_recommended,
        isBookmarked: !!bookmark,
        isApplied: job.is_applied,
        scrapedAt: job.scraped_at
      };

      return {
        success: true,
        data: jobDetails
      };
    } catch (error) {
      return {
        success: false,
        message: '채용 공고 상세 정보 조회 중 오류가 발생했습니다.',
        error: error.message
      };
    }
  }

  // 다른 채용 공고 관련 메서드들...
}
```

### 12.5 백엔드 인증 미들웨어

프론트엔드에서 인증이 필요한 API 요청을 처리하기 위한 인증 미들웨어를 구현합니다:

```typescript
// AuthMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import UserTable from '../models/main/UserTable';

export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '인증 토큰이 필요합니다.'
      });
    }

    const token = authHeader.split(' ')[1];

    // 토큰 검증
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      email: string;
      role: string;
    };

    // 사용자 확인
    const user = await UserTable.findByPk(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 사용자입니다.'
      });
    }

    // 요청 객체에 사용자 정보 추가
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '인증 토큰이 만료되었습니다.',
        expired: true
      });
    }

    return res.status(401).json({
      success: false,
      message: '유효하지 않은 인증 토큰입니다.'
    });
  }
};

// 관리자 권한 확인 미들웨어
export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '관리자 권한이 필요합니다.'
    });
  }
  next();
};
```

이러한 백엔드 코드 구조는 프론트엔드에서 필요로 하는 모든 기능을 지원하며, 기존 스크래핑 및 매칭 로직을 재사용하면서 사용자 관리 및 인증 기능을 추가합니다.
