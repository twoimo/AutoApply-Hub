import {
  CreatedAt,
  DeletedAt,
  Model,
  UpdatedAt,
  AllowNull,
  Column,
  DataType,
} from "sequelize-typescript";

export default class ModelABC extends Model {
  @AllowNull(false)
  @Column({
    type: DataType.INTEGER({ length: 10, unsigned: true }),
    autoIncrement: true,
    primaryKey: true,
    comment: "고유 아이디",
  })
  id!: number;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;

  @DeletedAt
  deleted_at!: Date;
}
