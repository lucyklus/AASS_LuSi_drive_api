export interface ICreatePhotoDTO {
  name: string;
  cloudinaryLink: string;
}

export interface IUpdatePhotoDTO {
  name: string;
  albums: number[];
}

export interface ICreateAlbumDTO {
  name: string;
}
