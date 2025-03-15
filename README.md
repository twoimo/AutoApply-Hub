# 4주차 스터디 내용 정리 (코드 리뷰 요청본)

## 1. 채용공고 상세 페이지 세부 정보 추출 기법
ㄴ
`ScraperControlService` 클래스의 `extractJobDetails` 메소드는 웹 스크래핑의 핵심 기능을 담당합니다. 이 메소드는 Puppeteer를 활용하여 채용공고 상세 페이지에서 구조화된 정보를 추출합니다.

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
   ```typescript
   const companyName = getTextContent(".company_name") || getTextContent(".corp_name");
   const jobTitle = getTextContent(".job_tit") || getTextContent("h1.tit_job");
   ```
   - 여러 가능한 선택자를 순차적으로 시도하여 정보 추출 성공률 향상
   - 사이트 리디자인이나 구조 변경에 강인한 적응력 제공

3. **정규식 기반 정보 추출**
   ```typescript
   const extractDeadline = (): string => {
     // 텍스트에서 날짜 패턴 찾기
     const datePattern = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/g;
     const timePattern = /\d{1,2}:\d{2}/g;
     // ...
   };
   ```
   - 비정형화된 텍스트에서 날짜, 시간과 같은 특정 패턴 정보를 효율적으로 추출
   - 다양한 형식(YYYY-MM-DD, YYYY.MM.DD 등)을 처리할 수 있는 유연성

4. **가시성 높은 로깅 시스템**
   - 이모지와 구분선을 활용한 직관적 콘솔 로그
   - 각 단계별 처리 상태와 결과를 명확히 표시하여 디버깅 효율 향상

**개선 가능한 점:**

1. **캐싱 메커니즘 도입**
   - 동일 URL에 대한 반복 요청을 방지하는 캐싱 레이어 추가
   - 이미 방문한 URL 정보를 메모리 또는 외부 저장소에 캐싱하여 성능 향상

2. **적응형 대기 시간 알고리즘**
   - 현재는 고정된 `waitTime`을 사용하지만, 페이지 로드 상태에 따라 동적으로 대기 시간 조절
   - 네트워크 상태, 페이지 복잡성에 따라 자동 조절되는 대기 시간 구현

3. **에러 복구 메커니즘 강화**
   - 특정 실패 패턴에 대한 재시도 로직 구현
   - 임시적인 네트워크 이슈나 서버 부하로 인한 실패에 대응하는 지수 백오프 전략 적용

## 2. Sequelize-TypeScript ORM을 활용한 데이터 모델링

`AutoApplyTable` 클래스는 Sequelize-TypeScript를 사용하여 채용공고 정보를 저장하기 위한 데이터 모델을 정의합니다.

```typescript
@Table({
  freezeTableName: true,
  tableName: "auto_apply_table",
})
export default class AutoApplyTable extends ModelABC {
  @AllowNull(false)
  @Column({
    type: DataType.STRING,
    comment: "회사명",
  })
  company_name!: string;

  // 추가 필드 정의...

  @AllowNull(true)
  @Column({
    type: DataType.BOOLEAN,
    comment: "지원 여부",
    defaultValue: false,
  })
  is_applied!: boolean;
}
```

**구현 특징 및 장점:**

1. **데코레이터 기반 스키마 정의**
   - TypeScript 데코레이터를 활용해 직관적이고 선언적인 테이블/컬럼 정의
   - 코드와 데이터베이스 스키마 간의 일관성 보장

2. **강력한 타입 안전성**
   - TypeScript의 타입 시스템을 활용하여 컴파일 타임에 데이터 타입 오류 감지
   - 런타임 타입 불일치 오류 방지 및 개발 생산성 향상

3. **메타데이터 주석**
   ```typescript
   @Column({
     type: DataType.STRING,
     comment: "채용 공고 제목",
   })
   ```
   - 각 필드에 comment를 통한 명확한 설명 제공
   - 데이터베이스 스키마 자체에 메타데이터가 포함되어 문서화 효과

4. **상속을 통한 기본 기능 재사용**
   ```typescript
   export default class AutoApplyTable extends ModelABC {
     // ...
   }
   ```
   - 공통 필드(ID, 생성일, 수정일 등)와 메소드를 ModelABC에서 상속받아 코드 중복 제거
   - 일관된 모델 구조 유지 및 개발 생산성 향상

**확장 제안:**

1. **인덱싱 전략 개선**
   - 자주 검색되는 필드(`company_name`, `job_title`)에 대한 인덱스 추가
   - 복합 인덱스 생성으로 복잡한 쿼리 성능 최적화

2. **관계 정의 추가**
   ```typescript
   @HasMany(() => ApplyHistory)
   apply_histories?: ApplyHistory[];
   ```
   - 지원 이력, 관심 공고 등 관련 모델과의 관계 정의
   - 데이터 모델 간 명확한 관계 설정으로 복잡한 쿼리 단순화

3. **가상 필드 및 메소드 추가**
   ```typescript
   @Column(DataType.VIRTUAL)
   get daysUntilDeadline(): number {
     if (!this.deadline) return -1;
     // 마감일까지 남은 일수 계산 로직
   }
   ```
   - 비즈니스 로직을 모델에 캡슐화하여 재사용성 향상
   - 마감임박 여부, 지원가능 상태 등 파생 정보 자동 계산

이러한 웹 스크래핑 아키텍처와 ORM 모델링 접근법은 단순한 데이터 수집을 넘어, 견고하고 확장 가능한 시스템을 구축하는 데 기여합니다. 특히 타입 안전성과 모듈화된 설계는 장기적인 유지보수와 확장에 큰 이점을 제공합니다.
