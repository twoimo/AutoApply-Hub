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

이러한 구현을 통해:
- MainServiceCommunicateService에서 캡슐화를 통한 서비스 은닉
- ScraperServiceABC 추상 클래스 상속을 통한 스크래핑 기능 추상화
- 실제 프로덕션 코드에서 OOP 원칙 적용

## 🔍 기술 연구

### 웹 스크래핑 기술
| 방식              | 장점                  | 단점                  |
| ----------------- | --------------------- | --------------------- |
| BeautifulSoup     | 정적 콘텐츠 처리 우수 | 동적 콘텐츠 처리 제한 |
| JavaScript 엔진 ✅ | 동적 콘텐츠 처리 가능 | 리소스 사용량 높음    |
| 네트워크 분석     | API 직접 호출 가능    | 인증 처리 복잡        |

### 렌더링 방식
| 방식 | 특징                        | 적용                 |
| ---- | --------------------------- | -------------------- |
| CSR  | - 동적 렌더링<br>- SPA 적합 | JavaScript 엔진 필수 |
| SSR  | - 서버 렌더링<br>- SEO 유리 | HTML 파싱 가능       |

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