# 채용 정보 자동화 시스템

## 프로젝트 개요
- 구인구직 사이트(사람인 등)를 자동으로 순회하며 설정된 조건에 맞는 회사에 이력서를 자동으로 제출하는 오픈소스 프로젝트

### 주요 기능
- 구인구직 사이트 자동 크롤링
- 맞춤형 회사 필터링
- 이력서 자동 제출
- 지원 이력 관리

## 기술 스택

### 백엔드
- Node.js & TypeScript
- MySQL & Sequelize ORM
- OpenAI API
- MistralAI API

### 프론트엔드
- React & Next.js
- TypeScript

### 개발 도구
- Docker - 컨테이너 관리
- DBeaver - 데이터베이스 관리
- dbdiagram.io - ERD 설계
- Postman - API 테스트

### Node.js 주요 라이브러리
- @qillie/wheel-common & wheel-micro-service
- Puppeteer & Cheerio - 웹 크롤링
- Sharp & Jimp - 이미지 처리
- Sequelize-typescript - ORM
- ts-node-dev - 개발 서버

## 개발 환경 설정

### 1. 필수 도구 설치
- Docker Desktop
- Node.js & npm
- DBeaver Community Edition
- Postman
- OpenAI API 키

### 2. 데이터베이스 생성
```bash
docker run --name mysql-container -e MYSQL_ROOT_PASSWORD=0000 -d -p 3306:3306 mysql:latest
```

### 3. 프로젝트 설정
```bash
# 레포지토리 클론
git clone [repository-url]
cd wheel-micro-service-boilerplate-study

# 환경 설정 파일 생성
touch .npmrc .nvmrc .env

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
```

### 환경 설정 파일

#### 1. .env 설정
```bash
NODE_ENV="development"
# NODE_ENV="production"
```

#### 2. .npmrc 설정
- GitHub 패키지 레지스트리에서 @qillie 스코프의 패키지를 설치하기 위한 인증 토큰이 필요합니다
- GitHub Personal Access Token이 필요합니다
- 패키지 읽기 권한이 부여된 토큰을 발급 받아야 합니다

#### 3. .nvmrc 설정
- 프로젝트에서 사용하는 Node.js 버전을 지정하는 파일입니다
- 팀원들과 동일한 Node.js 버전을 사용하기 위해 필요합니다
- Node.js 버전 관리자(nvm)에서 사용됩니다

### 4. 애플리케이션 실행
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

## 개발 가이드

### 데이터베이스
- ERD 설계: https://dbdiagram.io
- DBeaver 연결 정보:
  ```
  Host: localhost:3306
  Database: wheel_service
  Username: root
  Password: 0000
  ```

## 프로젝트 구조
```
wheel-micro-service-boilerplate-study/
├── src/
│   ├── api/
│   ├── models/
│   ├── services/
│   └── index.ts
├── database/
│   └── erd.dbml
├── tests/
└── README.md
```

## 개발 진행 상황

### 1~2주차 스터디 내용
- 개발 환경 설정 및 프로젝트 초기화 작업 위주로 진행하였습니다.

### 3주차 스터디 내용

#### 1. 서비스 구조

##### 개발자 서비스
- `MainServiceCommunicateService`: 주요 통신 및 데이터 처리 담당
- `ScraperControlService`: 웹 스크래핑 작업 제어 및 오류 처리

#### 2. OOP vs PP 비교 연구
- 객체지향 프로그래밍과 절차지향 프로그래밍의 특징을 비교 분석했습니다.

##### OOP의 핵심 특징
1. **캡슐화 (Encapsulation)**
   - 데이터와 메서드를 하나의 단위로 묶어 정보를 은닉
2. **상속 (Inheritance)**
   - 기존 클래스 특성을 재사용하여 코드 재사용성 향상
3. **다형성 (Polymorphism)**
   - 동일 인터페이스로 다양한 구현 가능
4. **추상화 (Abstraction)**
   - 복잡한 시스템을 단순화하여 핵심 개념만 표현
5. **객체간 통신**
   - 느슨한 결합을 통한 유연한 시스템 구조 구현

##### 실습 내용
- 프로젝트의 두 핵심 서비스에서 OOP 원칙을 실제 적용했습니다.

1. **MainServiceCommunicateService의 캡슐화 적용**
```typescript
// src/services/developer/MainServiceCommunicateService.ts
export default class MainServiceCommunicateService extends MicroServiceABC {
    // 캡슐화: private 접근 제어자를 통한 내부 서비스 은닉
    private apiCallService = new ApiCallService([]);
    private dataConverterService = new DataConverterService([]);
    private ScraperControlService = new ScraperControlService([]);

    // public 메서드를 통한 기능 제공
    public async run({}: {}) {
        await this.ScraperControlService.openSaramin({});
    }
}
```

2. **ScraperControlService의 추상화 적용**
```typescript
// src/services/utils/ScraperControlService.ts
export default class ScraperControlService extends ScraperServiceABC {
    // 추상 클래스를 상속받아 스크래핑 기능 구현
    public async openSaramin({}: {}) {
        // 브라우저 설정 추상화
        const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                "--disable-web-security",
                "--disable-features=IsolateOrigins,site-per-process",
                "--allow-running-insecure-content",
            ],
        });
        // ...스크래핑 로직 구현
    }
}
```

#### 3. 웹 스크래핑 기술 비교

| 스크래핑 방식     | 구현 도구                | 장단점                                                                                 |
| ----------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| DOM 스크래핑      | BeautifulSoup, Cheerio   | ✅ 구현 간단<br>✅ 낮은 리소스 사용<br>❌ 동적 콘텐츠 처리 불가<br>❌ JavaScript 처리 제한 |
| 브라우저 자동화   | Puppeteer, Selenium      | ✅ 동적 콘텐츠 처리<br>✅ 실제 브라우저 동작<br>❌ 높은 리소스 사용<br>❌ 실행 속도 느림   |
| 네트워크 인터셉션 | Chrome DevTools Protocol | ✅ 정확한 데이터 수집<br>✅ 서버 부하 최소화<br>❌ API 구조 분석 필요<br>❌ CORS 제한      |
| API 직접 호출     | Axios, Fetch             | ✅ 최고의 성능<br>✅ 정확한 데이터<br>❌ API 분석 필요<br>❌ 인증 처리 복잡                |

#### 4. 개발자 생산성

##### 프레임워크 이점
- ⚡ 신속한 개발: 추상 클래스 활용
- 🔄 코드 재사용: 공통 유틸리티 제공
- 📈 품질 향상: 표준화된 패턴 적용

##### 향상된 개발 효율성
- `ScraperServiceABC`와 같은 내장 추상 클래스로 신속한 서비스 개발 기반 제공
- `sleep`과 같은 공통 유틸리티로 기본 기능 재작성 불필요
- 표준화된 패턴으로 상용구 코드 감소 및 개발 시간 단축

### 4주차 스터디 내용

#### 1. 채용공고 상세 페이지 세부 정보 추출 기법

- `ScraperControlService` 클래스의 `extractJobDetails` 메소드는 웹 스크래핑의 핵심 기능을 담당
- Puppeteer를 활용하여 채용공고 상세 페이지에서 구조화된 정보를 추출

```typescript
private async extractJobDetails(page: Page, url: string, waitTime: number): Promise<JobInfo | null> {
  try {
    // 로깅 및 페이지 이동
    console.log(`\n=============================`);
    console.log(`🔍 채용공고 상세 페이지 처리 시작: ${url}`);
    
    await page.goto(url, { waitUntil: "networkidle2" });
    await sleep(waitTime);

    // 페이지 내 자바스크립트 실행하여 채용정보 추출
    const jobInfo = await page.evaluate(() => {
      // DOM 탐색 및 데이터 추출 로직
      // ...
    });

    // 결과 로깅 및 반환
    if (jobInfo) {
      console.log(`\n✅ 채용정보 추출 성공`);
      console.log(`🏢 회사명: ${jobInfo.companyName}`);
      // ...
    }

    return jobInfo;
  } catch (error) {
    console.error(`❌ ${url}에서 채용정보 추출 실패: ${error}`);
    return null;
  }
}
```

**핵심 기술 및 장점:**

1. **계층형 DOM 탐색 전략**
   - `.wrap_jv_cont` 컨테이너를 찾아 해당 범위 내에서만 정보를 추출함으로써 성능 최적화
   - CSS 선택자 기반 접근으로 DOM 구조 변화에 유연하게 대응

2. **다중 선택자 대체 전략**
   - 여러 가능한 선택자를 순차적으로 시도하여 정보 추출 성공률 향상
   - 사이트 리디자인이나 구조 변경에 강인한 적응력 제공

3. **정규식 기반 정보 추출**
   - 비정형화된 텍스트에서 날짜, 시간과 같은 특정 패턴 정보를 효율적으로 추출
   - 다양한 형식(YYYY-MM-DD, YYYY.MM.DD 등)을 처리할 수 있는 유연성

### 5주차 스터디 내용

#### 1. 데이터베이스 연동 및 스마트 크롤링 기능 구현

- `ScraperControlService`가 크롤링한 데이터를 효율적으로 관리하기 위해 데이터베이스 저장 기능 추가
- 더 스마트한 크롤링 로직 구현

##### 1.1 채용정보 데이터베이스 저장 구현

```typescript
// 추출된 채용정보를 데이터베이스에 저장하는 코드
if (jobInfo) {
  // DB에 채용정보 저장 (scraped_at, is_applied 필드 추가)
  await CompanyRecruitmentTable.create({
    company_name: jobInfo.companyName,
    job_title: jobInfo.jobTitle,
    job_location: jobInfo.jobLocation,
    job_type: jobInfo.jobType,
    job_salary: jobInfo.jobSalary,
    deadline: jobInfo.deadline,
    job_url: url,
    scraped_at: new Date(), // 현재 시간으로 데이터 수집 일시 설정
    is_applied: false       // 초기 지원 여부는 false로 설정
  });
  
  console.log(`\n✅ 채용정보 추출 성공`);
}
```

**핵심 구현 요소:**

1. **Sequelize ORM 활용**
   - TypeScript와 Sequelize를 활용하여 SQL 쿼리 없이 객체 형태로 데이터베이스 조작
   - `await` 키워드로 비동기 데이터베이스 작업 완료 대기
   - `create()` 메소드를 사용해 새 레코드 생성

2. **수집 메타데이터 저장**
   - `scraped_at`: 데이터 수집 시점을 저장하여 크롤링 이력 관리
   - `is_applied`, `is_gpt_checked`: 후속 처리 상태 추적을 위한 플래그

##### 1.2 중복 방지 스마트 크롤링 구현

- 불필요한 리소스 낭비를 줄이기 위해 이미 수집된 채용정보는 건너뛰고, 중복이 많이 발견될 경우 크롤링을 자동으로 중단하는 로직을 구현했습니다.

```typescript
// URL을 기준으로 중복 체크 및 스크래핑 중단 로직
const existingJob = await CompanyRecruitmentTable.findOne({
  where: { job_url: fullUrl }
});

if (existingJob) {
  console.log(`🔄 이미 수집된 채용공고입니다: ${fullUrl}`);
  duplicatesInThisPage++;
  
  // 페이지 내 중복이 5개 이상이면 해당 페이지 스크래핑 중단
  if (duplicatesInThisPage >= 5) {
    console.log(`\n⚠️ 이 페이지에서 5개 이상의 중복된 채용공고가 발견되었습니다.`);
    continueScrapping = false;
    break;
  }
  
  continue; // 해당 채용공고 건너뛰기
}
```

**스마트 크롤링 전략:**

1. **URL 기반 중복 탐지**
   - 데이터베이스에 이미 존재하는 URL인지 확인하여 중복 수집 방지
   - 채용공고 URL을 유니크 식별자로 활용

2. **자동 중단 임계값 설정**
   - 한 페이지에서 5개 이상 중복 발견 시 해당 페이지 크롤링 중단
   - 연속 3개 페이지에서 새로운 채용공고가 없을 경우 전체 크롤링 중단
   - 중복 패턴 감지를 통한 효율적 리소스 관리

#### 2. OpenAI 어시스턴트와 벡터 스토어 활용 이력서 필터링

- 채용공고 데이터를 OpenAI의 벡터 스토어에 저장하고, 맞춤형 어시스턴트를 활용하여 이력서 필터링 프로세스를 자동화하는 방법을 구현했습니다.

##### 2.1 OpenAI 어시스턴트 설정 및 지시어 작성

- OpenAI Playground Assistants를 활용하여 다음과 같은 작업을 수행했습니다:

1. **시스템 지시어 설정**
   - 어시스턴트의 역할 정의: 채용공고와 이력서 매칭 분석가
   - 입력값(채용공고와 이력서)과 출력값(적합 여부 판단) 명확화
   - 판단 기준과 응답 형식 구체화

2. **벡터 스토어 연동**
   - 채용데이터 벡터화를 통한 효율적 검색 및 분석 지원
   - File Search 도구 활성화 및 벡터 스토어 연결
   - 채용공고 데이터셋 업로드

##### 2.2 데이터베이스 모델 확장

- GPT 분석 결과와 지원 상태를 추적하기 위해 데이터 모델을 확장했습니다:

```typescript
@AllowNull(true)
@Column({
  type: DataType.BOOLEAN,
  comment: "GPT 체크 여부",
  defaultValue: false,
})
is_gpt_checked!: boolean;

@AllowNull(true)
@Column({
  type: DataType.BOOLEAN,
  comment: "지원 여부",
  defaultValue: false,
})
is_applied!: boolean;
```

### 6주차 스터디 내용 (2025.03.29)

#### 1. 사람인 로그인 코드 구현 (loginSaramin)

- **로그인 프로세스**:
  - 사람인 로그인 페이지(https://www.saramin.co.kr/zf_user/auth)에 접근
  - 실제 사용자처럼 아이디/비밀번호 필드 클릭 및 입력 후 로그인 버튼 클릭
  - 인증 방식: (1) JWT 토큰 인증 또는 (2) 세션 기반 인증

- **구현 방법**:
  - `services/utils/ScraperControlService.ts` 내에 `loginSaramin` 메소드 구현
  - 로그인 후 `page` 객체 반환 (로그인 인증 정보 유지를 위함)
  - 인증 정보를 활용하여 `MainServiceCommunicateService`에서 API 작업 수행

#### 2. 사람인 지원서 자동 접수 (writeSaraminApplication)

- **자동 지원 프로세스**:
  - 채용공고 페이지에서 "입사지원" 또는 "홈페이지 지원" 버튼 식별
  - "입사지원" 문자열 검사 후 클릭
  - iframe 모달 처리 (HTML 코드를 가져와 iframe 링크 추출)
  - 입사지원 버튼 클릭 및 지원 과정 자동화

- **구현 방법**:
  - 예외 처리를 위한 try-catch 구문 활용
  - 각 단계별 함수화 (재사용 가능한 코드 모듈화)
  - 지원 부문 등 다양한 케이스에 대한 예외 처리

#### 3. Mistral Small AI 매칭 코드 구현

- **Vector Store 없이 구현**:
  - 기존 구현에서 결과값이 부족했던 원인 분석:
    1. 인스트럭션 내 이력서 정보 불충분
    2. Vector Store 부족
    3. Vector Store 필터링으로 인한 결과 부족

- **개선 방법**:
  - Vector Store 사용 대신 DB row별 프롬프팅 적용
  - 구직자 프로필 정보와 함께 처리하여 매칭 정확도 향상

#### 4. 자동지원 - 지원부문 - AI 적용

- **AI 기반 직무 추천**:
  - 사용자 이력서 데이터 분석을 통한 적합 직무 자동 식별
  - 채용공고 요구사항과 사용자 스킬 매칭 알고리즘 적용
  - 직무 적합도 점수화 및 우선순위 추천

- **구현 방법**:
  - 이력서 키워드 추출 및 가중치 분석
  - 채용공고 직무별 필수/우대 요건 파싱
  - 적합도 기반 자동 선택 및 지원 진행
  - 사용자 피드백을 통한 추천 알고리즘 지속 개선

## 향후 개발 계획

1. **시점 설정 기능**
   - 마지막 크롤링 시점을 기준으로 증분식 데이터 수집
   - 불필요한 중복 스크래핑 최소화

2. **크론 작업 자동화**
   - 정기적인 채용정보 수집 자동화
   - 스케줄링을 통한 효율적 리소스 활용

3. **이력서 자동 지원 시스템**
   - GPT가 적합하다고 판단한 채용공고에 대한 자동 지원 프로세스 구현
   - 맞춤형 이력서와 자기소개서 생성 및 제출

4. **프론트엔드 대시보드**
   - 수집된 채용정보 시각화
   - 사용자 맞춤 필터링 인터페이스
   - 지원 이력 모니터링 기능

5. **성능 최적화**
   - 캐싱 메커니즘 도입
   - 분산 크롤링 시스템 구현
   - 에러 복구 메커니즘 강화
