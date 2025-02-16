# 3주차 스터디 내용 정리

## 📚 목차
- [서비스 구조](#서비스-구조)
- [연구 노트](#연구-노트)
- [기술 연구](#기술-연구)
- [개발자 생산성](#개발자-생산성)

## 🔧 서비스 구조

### 개발자 서비스
| 서비스                          | 설명                               |
| ------------------------------- | ---------------------------------- |
| `MainServiceCommunicateService` | 주요 통신 및 데이터 처리 담당      |
| `ScraperControlService`         | 웹 스크래핑 작업 제어 및 오류 처리 |

## 📖 연구 노트

### OOP vs PP 비교 연구
객체지향 프로그래밍과 절차지향 프로그래밍의 특징을 비교 분석했습니다.

#### 📌 OOP의 핵심 특징
1. **캡슐화 (Encapsulation)**
   ```
   데이터와 메서드를 하나의 단위로 묶어 정보를 은닉
   ```

2. **상속 (Inheritance)**
   ```
   기존 클래스 특성을 재사용하여 코드 재사용성 향상
   ```

3. **다형성 (Polymorphism)**
   ```
   동일 인터페이스로 다양한 구현 가능
   ```

4. **추상화 (Abstraction)**
   ```
   복잡한 시스템을 단순화하여 핵심 개념만 표현
   ```

5. **객체간 통신**
   ```
   느슨한 결합을 통한 유연한 시스템 구조 구현
   ```

#### 실습 내용
프로젝트의 두 핵심 서비스에서 OOP 원칙을 실제 적용했습니다.

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

3. **채용공고 스크래핑 구현**
```typescript
export default class ScraperControlService extends ScraperServiceABC {
    public async openSaramin({}: {}) {
        // 브라우저 설정
        const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                "--disable-web-security",
                "--disable-features=IsolateOrigins,site-per-process",
                "--allow-running-insecure-content",
            ],
        });

        const page = await browser.newPage();
        
        // URL 파라미터 분석 및 데이터 수집
        // - page: 페이지 번호 (2~20)
        // - loc_mcd: 지역 코드 (101000,102000 = 서울,경기)
        // - cat_kewd: 직종 카테고리 (2248,82,83,107,108,109 = IT/개발 직군)
        // - page_count: 한 페이지당 표시 개수 (50)
        // - sort: 정렬 방식 (RL = 관련도순)
        for (let i = 2; i <= 20; i++) {
            const searchURL = `https://www.saramin.co.kr/zf_user/jobs/list/domestic?page=${i}&loc_mcd=101000%2C102000&cat_kewd=2248%2C82%2C83%2C107%2C108%2C109&page_count=50&sort=RL`;
            await page.goto(searchURL);
            
            // 채용공고 링크 추출 및 처리
            const jobLinks = await page.evaluate(() => {
                // DOM 스크래핑 로직
            });
        }
    }
}
```

이러한 구현을 통해:
- MainServiceCommunicateService에서 캡슐화를 통한 서비스 은닉
- ScraperServiceABC 추상 클래스 상속을 통한 스크래핑 기능 추상화
- Puppeteer를 활용한 헤드리스 브라우저 제어
- URL 파라미터 기반 동적 검색 조건 처리
- 페이지네이션을 통한 대량 채용정보 수집 (2~20페이지)
- 지역 및 직종 필터링을 통한 타겟 채용정보 스크래핑
- 실제 프로덕션 코드에서 OOP 원칙 적용

## 🔍 기술 연구

### 웹 스크래핑 기술
| 스크래핑 방식     | 구현 도구                | 특징                                                                        | 장단점                                                                                 |
| ----------------- | ------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| DOM 스크래핑      | BeautifulSoup, Cheerio   | - HTML 구조 직접 파싱<br>- CSS 선택자 활용<br>- 정적 콘텐츠 처리            | ✅ 구현 간단<br>✅ 낮은 리소스 사용<br>❌ 동적 콘텐츠 처리 불가<br>❌ JavaScript 처리 제한 |
| 브라우저 자동화   | Puppeteer, Selenium      | - 실제 브라우저 제어<br>- JavaScript 실행 가능<br>- 사용자 행동 시뮬레이션  | ✅ 동적 콘텐츠 처리<br>✅ 실제 브라우저 동작<br>❌ 높은 리소스 사용<br>❌ 실행 속도 느림   |
| 네트워크 인터셉션 | Chrome DevTools Protocol | - XHR/Fetch 요청 감시<br>- API 응답 데이터 수집<br>- 네트워크 트래픽 분석   | ✅ 정확한 데이터 수집<br>✅ 서버 부하 최소화<br>❌ API 구조 분석 필요<br>❌ CORS 제한      |
| API 직접 호출     | Axios, Fetch             | - 식별된 API 엔드포인트 호출<br>- 인증/헤더 처리<br>- 응답 데이터 직접 처리 | ✅ 최고의 성능<br>✅ 정확한 데이터<br>❌ API 분석 필요<br>❌ 인증 처리 복잡                |

### 렌더링 방식 비교
| 렌더링 방식                 | 대표 프레임워크 | 작동 방식                                                                                 | 특징                                                          | 장단점                                                                   |
| --------------------------- | --------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| CSR (Client-Side Rendering) | React           | - 빈 HTML 다운로드<br>- JS 번들 다운로드<br>- 클라이언트에서 렌더링<br>- Virtual DOM 활용 | - SPA 구조<br>- JavaScript 의존도 높음<br>- 동적 UI 처리 용이 | ✅ 빠른 페이지 전환<br>✅ 서버 부하 감소<br>❌ 초기 로딩 느림<br>❌ SEO 불리 |
| SSR (Server-Side Rendering) | Next.js         | - 서버에서 HTML 생성<br>- 완성된 HTML 전송<br>- Hydration 과정 수행<br>- TTV/TTI 최적화   | - MPA/SPA 하이브리드<br>- SEO 최적화<br>- 초기 로딩 최적화    | ✅ 빠른 초기 로딩<br>✅ SEO 유리<br>❌ 서버 자원 필요<br>❌ TTFB 증가        |

## 🚀 개발자 생산성

### 프레임워크 이점
- ⚡ 신속한 개발: 추상 클래스 활용
- 🔄 코드 재사용: 공통 유틸리티 제공
- 📈 품질 향상: 표준화된 패턴 적용

`@qillie/wheel-micro-service` 프레임워크는 마이크로서비스 개발에서 개발자의 생산성과 역량을 크게 향상시킵니다:

### 🚀 향상된 개발 효율성
- `ScraperServiceABC`와 같은 내장 추상 클래스로 신속한 서비스 개발 기반 제공
- `sleep`과 같은 공통 유틸리티로 기본 기능 재작성 불필요
- 표준화된 패턴으로 상용구 코드 감소 및 개발 시간 단축

### 💪 개발자 역량 강화
- 일관된 아키텍처 패턴으로 비즈니스 로직에 집중 가능
- 추상 기본 클래스로 모범 사례 자동 준수
- 내장된 데이터 동기화 및 연결 관리 기능으로 복잡성 감소

### 🎯 중요성
마이크로서비스 분야에서 개발자 생산성이 중요한 이유:
- 신속한 서비스 배포 및 반복
- 일관된 코드 품질 유지
- 새로운 기능의 시장 출시 시간 단축
- 유지보수 가능하고 확장 가능한 코드베이스 보장

프레임워크의 구조화된 접근 방식은 높은 코드 품질 표준을 유지하면서 개발 주기를 가속화하는 데 매우 중요한 역할을 합니다.