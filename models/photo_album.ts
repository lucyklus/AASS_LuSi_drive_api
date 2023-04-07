import { Column, ForeignKey, Model, Table } from 'sequelize-typescript';
import { Photo } from './photo';
import { Album } from './album';

@Table
export class PhotoAlbum extends Model {
  @ForeignKey(() => Photo)
  @Column
  photoId!: number;

  @ForeignKey(() => Album)
  @Column
  albumId!: number;
}
