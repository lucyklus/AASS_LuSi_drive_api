import { Table, Column, Model, BelongsToMany, Unique } from 'sequelize-typescript';
import { Album } from './album';
import { PhotoAlbum } from './photo_album';

@Table
export class Photo extends Model {
  @Unique
  @Column
  name!: string;

  @BelongsToMany(() => Album, () => PhotoAlbum)
  albums!: Array<Album & { PhotoAlbum: PhotoAlbum }>;
}
