import { ModelABC } from "@qillie/wheel-micro-service";
import { Table, AllowNull, Column, DataType } from "sequelize-typescript";

@Table({
  freezeTableName: true,
  tableName: "company_recruitment",
})
export default class CompanyRecruitmentTable extends ModelABC {
  @AllowNull(false)
  @Column({
    type: DataType.STRING,
    comment: "회사명",
  })
  company_name!: string;

  @AllowNull(false)
  @Column({
    type: DataType.STRING,
    comment: "채용 공고 제목",
  })
  job_title!: string;

  @AllowNull(true)
  @Column({
    type: DataType.STRING,
    comment: "근무 지역",
  })
  job_location!: string;

  @AllowNull(true)
  @Column({
    type: DataType.STRING,
    comment: "경력 조건",
  })
  job_type!: string;

  @AllowNull(true)
  @Column({
    type: DataType.STRING,
    comment: "급여 정보",
  })
  job_salary!: string;

  @AllowNull(true)
  @Column({
    type: DataType.STRING,
    comment: "마감일",
  })
  deadline!: string;

  @AllowNull(true)
  @Column({
    type: DataType.TEXT,
    comment: "채용 공고 URL",
  })
  job_url!: string;

  @AllowNull(false)
  @Column({
    type: DataType.DATE,
    comment: "데이터 수집 일시",
    defaultValue: DataType.NOW,
  })
  scraped_at!: Date;
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
}
