import { ModelABC } from "@qillie/wheel-micro-service";
import { Table, AllowNull, Column, DataType } from "sequelize-typescript";

@Table({
  freezeTableName: true,
  tableName: "test",
})
export default class TestTable extends ModelABC {
  @AllowNull(false)
  @Column({
    type: DataType.STRING,
    comment: "테스트로 생성된 이름 컬럼",
  })
  name!: string;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(1000),
    comment: "테스트로 생성된 설명 컬럼",
  })
  description!: string;
}
