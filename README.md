# AutoApply-Hub

## 프로젝트 개요
구인구직 사이트(사람인 등)를 자동으로 순회하며 설정된 조건에 맞는 회사에 이력서를 자동으로 제출하는 오픈소스 프로그램

### 주요 기능
- 구인구직 사이트 자동 크롤링
- 맞춤형 회사 필터링
- 이력서 자동 제출
- 지원 이력 관리
- 실시간 진행 상황 모니터링

## 기술 스택

### 백엔드
- Node.js & TypeScript
- FastAPI (Python 3.9)
- MySQL & Sequelize ORM
- OpenAI GPT API

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

### 2. 데이터베이스 설정
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
GitHub 패키지 레지스트리에서 @qillie 스코프의 패키지를 설치하기 위한 인증 토큰이 필요합니다.
- GitHub Personal Access Token이 필요합니다
- 패키지 읽기 권한이 부여된 토큰을 발급 받아야 합니다

#### 3. .nvmrc 설정
프로젝트에서 사용하는 Node.js 버전을 지정하는 파일입니다.
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
