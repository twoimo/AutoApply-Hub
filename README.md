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

---

## 2. OpenAI 어시스턴트와 벡터 스토어 활용 이력서 필터링

채용공고 데이터를 OpenAI의 벡터 스토어에 저장하고, 맞춤형 어시스턴트를 활용하여 이력서 필터링 프로세스를 자동화하는 방법을 구현했습니다.

### 2.1 OpenAI 어시스턴트 설정 및 지시어 작성

OpenAI Playground Assistants를 활용하여 다음과 같은 작업을 수행했습니다:

1. **시스템 지시어 설정**
   - 어시스턴트의 역할 정의: 채용공고와 이력서 매칭 분석가
   - 입력값(채용공고와 이력서)과 출력값(적합 여부 판단) 명확화
   - 판단 기준과 응답 형식 구체화

> **예시: Claude 3.7 Sonnet Thinking를 활용한 시스템 지시어**
> 
> ```
> 당신은 구직자와 사람인의 채용공고를 매칭하는 AI 어시스턴트입니다. 채용 데이터베이스에서 가져온 정보를 분석하여 구직자와의 적합성을 판단합니다.
> 
> 역할:
> - 채용공고와 구직자 간의 적합성을 정밀하게 평가
> - 데이터가 부족하더라도 가용한 정보를 기반으로 평가 수행
> - 적합한 채용공고 목록과 그 이유를 제공
> 
> 평가 대상 채용공고 정보:
> - company_name: 회사명과 구직자의 관심 산업 분야 일치성 (필수 항목)
> - job_title: 직무 제목과 구직자의 전문 분야 연관성 (필수 항목)
> - job_location: 근무 지역과 구직자의 거주지(경기도 양주시) 접근성 (선택 항목)
> - job_type: 경력 조건과 구직자의 경력(석사 포함 약 2년) 부합 여부 (선택 항목)
> - job_salary: 제시된 급여와 구직자의 경력 수준 적절성 (선택 항목)
> - deadline: 지원 마감일과 현재 일자(2025년 3월 15일) 비교 (선택 항목)
> - job_url: 채용공고 상세 정보 접근성 (선택 항목)
> 
> 평가 프로세스:
> 1. 모든 데이터 필드가 비어있는지(null) 확인
> 2. 필수 항목(company_name, job_title)이 있는지 확인하고, 없을 경우 제외
> 3. 가용한 데이터를 기반으로 아래 기준에 따라 평가 진행
> 4. 최소 2개 이상의 평가 기준에서 부합할 경우 적합한 것으로 판단
> 
> 평가 기준 (세부):
> 5. 직무 적합성 (가중치: 높음)
>    - job_title에 다음 키워드 중 하나 이상 포함: AI, 인공지능, 머신러닝, 딥러닝, 컴퓨터 비전, 보안, 웹, 개발, 데이터, 분석, 연구, 프론트엔드, 백엔드, 풀스택, 소프트웨어, 프로그래밍, 엔지니어
>    - 데이터가 없는 경우: 이 기준은 평가에서 제외
> 
> 6. 경력 요구사항 부합성 (가중치: 중간)
>    - job_type에 다음 항목 중 하나 포함: 신입, 경력 무관, 경력 1~3년, 석사 우대, 연구 경력
>    - 데이터가 없는 경우: 이 기준은 평가에서 제외
> 
> 7. 지역 적합성 (가중치: 낮음)
>    - job_location에 다음 지역 포함: 서울, 경기, 재택, 원격, 하이브리드
>    - 특히 경기도 내 지역(성남, 용인, 수원, 부천, 안양 등)은 통근 가능 지역으로 간주
>    - 데이터가 없는 경우: 이 기준은 평가에서 제외
> 
> 8. 기업 문화 및 산업 분야 (가중치: 중간)
>    - company_name이 다음 분야 관련: 기술, IT, 소프트웨어, 연구소, 보안, AI, 데이터, 교육, 공공기관
>    - 데이터가 없는 경우: 이 기준은 평가에서 제외
> 
> 지원 권장 결정 기준:
> - 직무 적합성이 높고, 지역이 통근 가능하며, 경력 요구사항에 부합하는 경우: 지원 권장 (apply_yn: true)
> - 적합도는 높지만 일부 기준에서만 부합하는 경우: 검토 후 지원 (apply_yn: false)
> 
> 입력 데이터 처리:
> - 누락된 필드(null)는 평가에서 제외
> - 필수 필드(company_name, job_title)가 없는 경우 즉시 제외
> - 모든 텍스트 데이터는 대소문자 구분 없이 평가
> 
> 출력 형식:
> 다음과 같은 JSON 형식으로 결과를 반환:
> [
> {
>    "id": 채용공고 ID,
>    "reason": "이 채용공고는 [적합성 이유]",
>    "apply_yn": true/false
> },
> {
>    "id": 채용공고 ID,
>    "reason": "이 채용공고는 [적합성 이유]",
>    "apply_yn": true/false
> },
> ...
> ]
> ```

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

---

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

## 4. 구현 참고사항

1. **데이터베이스 연동**
   - ScraperControlService.ts: 크롤링 데이터를 데이터베이스 모델에 저장
   - await 키워드로 비동기 함수 완료 대기
   - 시퀄라이즈 라이브러리의 create() 메소드로 SQL 없이 데이터 조작

2. **OpenAI 통합**
   - Vector Store 생성: 채용데이터 효율적 검색을 위한 벡터화
   - File Search 도구 활성화 및 벡터 스토어 연결
   - 대량의 채용공고 데이터 업로드 및 분석

3. **데이터베이스 스키마 확장**
   - CompanyRecruitmentTable 모델 확장: is_gpt_checked, is_applied 컬럼 추가
   - 기존 테이블에 컬럼 추가 방법: DBeaver에서 테이블 properties에서 컬럼 추가
   - 데이터 타입은 tinyint, 기본값은 0으로 설정

4. **스마트 크롤링 최적화**
   - 중복 방지 및 자동 중단 로직 개선
   - URL 기준 중복 탐지
   - 임계값 기반 크롤링 효율화

## 5. 원본 필기

> 엄, 오늘은 gpt vector store에 저장하고, 어시스턴스 연결, 적절하게 프롬프팅해서 이력서 필터링할 것임.
> 
> 인스트럭트를 플레이그라운드에서 해볼것, 웹으로 해보고 코드로 야무지게 만들 예정.
> 
> 고 다음, 크롤링 코드 문제가 뭐냐. 처음부터 끝까지 크롤링하는 것이 문제.
> 
> 이젠 데이터를 저장할 수 있으니 시점을 설정할 수 있는 코드 만들기.
> 
> 크론탭 설치 및 실행가지 오늘 목표
> 
> -----------------------------
> 
> 1. ScraperControlSevice.ts 콘솔 로그 찍는 쪽에서 크롤링한 데이터를 데이터베이스 모델(auto_apply_table.ts)에 저장시킬거임.
> 
> await은 함수가 끝날 때까지 대기한다는 뜻임. 입력 값으로 넣는 딕셔너리 왼쪽에는 본인 DB 모델 키값(컬럼명) 넣으면 됨.
> 
> 시퀄라이즈 라이브러리 메소드 중 .create 사용하면 타입 스크립트로 sql을 조작할 수 있음. 
> 
> 2. openai groundplay assistants
> https://platform.openai.com/playground/assistants?assistant=asst_3XjLZH7JzKBH2XAgebFYnnyb
> 
> 2-1. system instructions 작성: 너는 뭐하는 녀석이다, 
>  2-1-1. 너는 뭐하는 녀석이야(역할 부여).
>  2-1-2. 입력값(이력서), 출력값(true, false)
>  2-1-3. vector store 활용
>   * 데이터 라벨링하면 더욱 좋은 효과를 보여줌
> 
> 3. DBeaver 테이블 내보내기, fetch size(10000), 디렉토리, 인코딩(UTF-8,EUR-KR)
> 
> 4. Assistants TOOLS -> file search 옵션 키셈 -> 좌측 아래 select vector store -> Vector store -> create
> * 어시스턴트 하나당 vector store 하나 밖에 연결 못함
> 
> 5. 다시 assistants tools로 가서 방금 만든 벡터 스토어 id 검색해서 파일 업로드 -> 테스트 -> system instructions 업그레이드
> 
> 6. ConpanyRecruitmentTable.ts 모델 수정: 컬럼 추가
> * gpt가 체크했는지 안했는지 컬럼추가. (리소스 문제 해소, defautValue 기본값)
> * 지원 여부 (채용공고 자동 지원 코드까지 만들기 때문)
> * url 추가 (매번 수집하는건 불필요한 작업임, 최근 직전 영역까지 수집 구분 필요)
> 
> 7. DBeaver에서 자기 테이블에서 6번 컬럼 직접 추가 (우리는 mysql이기 때문, nosql이면 자동 추가 가능)
> * 테이블 properties에서 컬럼명 보이는쪽에서 우클릭한 다음에 컬럼 추가.
> * 컬럼 추가할 때 속성은, 이름은 이름 넣고, data type은 tinyint. 그리고 디폴트 값은 "0" 그리고 좌하단 Save
> 
> 8. ScraperCOntrolService.ts 가서 반복문 break 시키는 코드 수정.