# 4주차 스터디 내용 정리

## 1. 데이터베이스 연동 및 스마트 크롤링 기능 구현

`ScraperControlService`가 크롤링한 데이터를 효율적으로 관리하기 위해 데이터베이스 저장 기능을 추가하고, 더 스마트한 크롤링 로직을 구현했습니다.

### 1.1 채용정보 데이터베이스 저장 구현

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
  // 로깅 코드...
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

### 1.2 중복 방지 스마트 크롤링 구현

불필요한 리소스 낭비를 줄이기 위해 이미 수집된 채용정보는 건너뛰고, 중복이 많이 발견될 경우 크롤링을 자동으로 중단하는 로직을 구현했습니다.

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

3. **진행 상황 실시간 모니터링**
   - 이모지와 구조화된 로깅으로 크롤링 진행 상황 가시화
   - 중복 발견, 새 데이터 추가 등 주요 이벤트에 대한 상세 로깅

## 2. OpenAI 어시스턴트와 벡터 스토어 활용 이력서 필터링

채용공고 데이터를 OpenAI의 벡터 스토어에 저장하고, 맞춤형 어시스턴트를 활용하여 이력서 필터링 프로세스를 자동화하는 방법을 구현했습니다.

### 2.1 OpenAI 어시스턴트 설정 및 지시어 작성

OpenAI Playground Assistants를 활용하여 다음과 같은 작업을 수행했습니다:

1. **시스템 지시어 설정**
   - 어시스턴트의 역할 정의: 채용공고와 이력서 매칭 분석가
   - 입력값(채용공고와 이력서)과 출력값(적합 여부 판단) 명확화
   - 판단 기준과 응답 형식 구체화

2. **벡터 스토어 연동**
   - 채용데이터 벡터화를 통한 효율적 검색 및 분석 지원
   - File Search 도구 활성화 및 벡터 스토어 연결
   - 채용공고 데이터셋 업로드

### 2.2 데이터베이스 모델 확장

GPT 분석 결과와 지원 상태를 추적하기 위해 데이터 모델을 확장했습니다:

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

**데이터 모델 개선점:**

1. **처리 상태 추적**
   - `is_gpt_checked`: 리소스 절약을 위해 이미 분석된 채용공고 구분
   - `is_applied`: 향후 자동 지원 프로세스를 위한 지원 상태 추적

2. **데이터베이스 스키마 관리**
   - 기존 테이블에 새로운 컬럼 추가
   - 기본값 설정으로 기존 데이터와의 호환성 유지

## 3. 다음 단계 및 향후 계획

현재까지의 구현을 기반으로 다음과 같은 기능을 추가로 개발할 예정입니다:

1. **시점 설정 기능**
   - 마지막 크롤링 시점을 기준으로 증분식 데이터 수집
   - 불필요한 중복 스크래핑 최소화

2. **크론 작업 자동화**
   - 정기적인 채용정보 수집 자동화
   - 스케줄링을 통한 효율적 리소스 활용

3. **이력서 자동 지원 시스템**
   - GPT가 적합하다고 판단한 채용공고에 대한 자동 지원 프로세스 구현
   - 맞춤형 이력서와 자기소개서 생성 및 제출

이번 주 스터디를 통해 스크래핑, 데이터베이스 연동, 그리고 AI 기반 분석의 기초를 다졌으며, 앞으로 더욱 지능적이고 자동화된 채용 시스템으로 발전시켜 나갈 계획입니다.