import { Table, Column, Model, BelongsToMany, Unique } from 'sequelize-typescript';
import { Photo } from './photo';
import { PhotoAlbum } from './photo_album';

@Table
export class Album extends Model {
  @Unique
  @Column
  name!: string;

  @BelongsToMany(() => Photo, () => PhotoAlbum)
  photos: Array<Photo & { PhotoAlbum: PhotoAlbum }> = [];
}
