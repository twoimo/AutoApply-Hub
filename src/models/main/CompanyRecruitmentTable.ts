/**
 * 🏢 회사 채용 정보 데이터베이스 테이블 모델
 * 
 * 📌 이 파일은 무엇인가요?
 * - 웹 스크래퍼가 수집한 채용 공고 정보를 저장하는 데이터베이스 테이블 구조를 정의합니다.
 * - Sequelize ORM을 사용하여 JavaScript/TypeScript에서 데이터베이스를 쉽게 다룰 수 있게 합니다.
 * 
 * 📚 주요 개념:
 * - @Table: 이 클래스가 데이터베이스 테이블에 매핑된다는 것을 나타냅니다.
 * - @Column: 테이블의 각 열(필드)을 정의합니다.
 * - @AllowNull: 해당 필드가 NULL 값을 허용하는지 여부를 설정합니다.
 * 
 * 💻 사용 방법:
 * - 이 모델을 import하여 채용 정보를 저장, 조회, 수정, 삭제할 수 있습니다.
 * - 예: CompanyRecruitmentTable.create({...}) - 새로운 채용 정보를 생성합니다.
 * 
 * ✨ 초보자를 위한 팁:
 * - 모델: 데이터베이스 테이블의 구조를 코드로 표현한 것입니다.
 * - ORM: 객체-관계 매핑으로, 데이터베이스와 객체지향 프로그래밍 언어 사이의 다리 역할을 합니다.
 * - 데코레이터(@): 클래스나 속성에 추가 기능이나 메타데이터를 부여하는 TypeScript 기능입니다.
 */
import { ModelABC } from "@qillie/wheel-micro-service";
import { Table, AllowNull, Column, DataType } from "sequelize-typescript";

// @Table 데코레이터: 이 클래스가 데이터베이스 테이블과 매핑됨을 나타냅니다
@Table({
  freezeTableName: true,  // 테이블 이름을 복수형으로 자동 변환하지 않음
  tableName: "company_recruitment",  // 실제 데이터베이스의 테이블 이름
})
export default class CompanyRecruitmentTable extends ModelABC {
  
  // 회사명 필드 - NULL 값을 허용하지 않음 (필수 입력 항목)
  @AllowNull(false)
  @Column({
    type: DataType.STRING,  // 문자열 타입으로 저장
    comment: "회사명",  // 데이터베이스 컬럼에 대한 설명
  })
  company_name!: string;  // ! 표시는 이 속성이 반드시 값을 가져야 함을 의미
  
  // 채용 공고 제목 필드 - 필수 입력 항목
  @AllowNull(false)
  @Column({
    type: DataType.STRING,
    comment: "채용 공고 제목",
  })
  job_title!: string;

  // 상세 채용 내용 필드 - 채용 공고의 상세 내용 (TEXT 타입으로 저장하여 대용량 텍스트 지원)
  @AllowNull(true)
  @Column({
    type: DataType.TEXT('long'),  // 대용량 텍스트를 저장할 수 있는 LONGTEXT 타입
    comment: "채용 공고 상세 내용 (텍스트 또는 OCR로 추출된 내용)",
  })
  job_description!: string;
  
  // 기업형태 필드 (예: 대기업, 중소기업, 스타트업 등) - 선택적 항목
  @AllowNull(true)  // NULL 값 허용 (정보가 없어도 됨)
  @Column({
    type: DataType.STRING,
    comment: "기업형태",
  })
  company_type!: string;

  // 근무 지역 필드 (예: 서울시 강남구, 경기도 성남시 등) - 선택적 항목
  @AllowNull(true)
  @Column({
    type: DataType.STRING,
    comment: "근무 지역",
  })
  job_location!: string;

  // 경력 조건 필드 (예: 신입, 경력 3년 이상 등) - 선택적 항목
  @AllowNull(true)
  @Column({
    type: DataType.STRING,
    comment: "경력 조건",
  })
  job_type!: string;

  // 급여 정보 필드 (예: 3,500만원, 회사 내규에 따름 등) - 선택적 항목
  @AllowNull(true)
  @Column({
    type: DataType.STRING,
    comment: "급여 정보",
  })
  job_salary!: string;

  // 마감일 필드 (예: 2023-12-31, 채용시 마감 등) - 선택적 항목
  @AllowNull(true)
  @Column({
    type: DataType.STRING,
    comment: "마감일",
  })
  deadline!: string;

  // 근무형태 필드 (예: 정규직, 계약직, 인턴, 파견직 등) - 선택적 항목
  @AllowNull(true)
  @Column({
    type: DataType.STRING,
    comment: "근무형태",
  })
  employment_type!: string;

  // 데이터 수집 일시 필드 - 이 정보가 언제 수집되었는지 기록 (필수 항목)
  @AllowNull(false)
  @Column({
    type: DataType.DATE,  // 날짜 타입으로 저장
    comment: "데이터 수집 일시",
    defaultValue: DataType.NOW,  // 기본값은 현재 시간 (따로 지정하지 않으면 자동으로 현재 시간이 저장됨)
  })
  scraped_at!: Date;

  // 채용 공고 URL 필드 - 원본 채용공고 링크 (선택적 항목)
  @AllowNull(true)
  @Column({
    type: DataType.TEXT,  // 긴 텍스트를 저장할 수 있는 타입 (URL은 길 수 있음)
    comment: "채용 공고 URL",
  })
  job_url!: string;

  // GPT 체크 여부 필드 - AI가 이 채용공고를 분석했는지 여부 (선택적 항목)
  @AllowNull(true)
  @Column({
    type: DataType.BOOLEAN,  // 참/거짓 값을 저장하는 타입
    comment: "GPT 체크 여부",
    defaultValue: false,  // 기본값은 false (초기에는 AI 체크를 하지 않은 상태)
  })
  is_gpt_checked!: boolean;

  // 지원 여부 필드 - 사용자가 이 채용공고에 지원했는지 여부 (선택적 항목)
  @AllowNull(true)
  @Column({
    type: DataType.BOOLEAN,
    comment: "지원 여부",
    defaultValue: false,  // 기본값은 false (초기에는 지원하지 않은 상태)
  })
  is_applied!: boolean;



  // 상세 내용 타입 필드 - 텍스트인지 OCR로 추출한 것인지 구분
  @AllowNull(true)
  @Column({
    type: DataType.STRING,
    comment: "상세 내용 추출 방식 (text 또는 ocr)",
    defaultValue: "text"
  })
  description_type!: string;
}
