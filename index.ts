import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import { Sequelize } from 'sequelize-typescript';

import { Photo } from './models/photo';
import { Album } from './models/album';
import { PhotoAlbum } from './models/photo_album';

dotenv.config();

const app: Express = express();
const port = process.env.PORT;

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './db/db.sqlite',
});
sequelize.addModels([Photo, Album, PhotoAlbum]);

app.get('/', (req: Request, res: Response) => {
  res.send('Express + TypeScript Server');
});

app.listen(port, async () => {
  await sequelize.sync();

  const album = await Album.create({ name: 'My Album' });
  const photo = await Photo.create({
    name: 'My Photo',
    cloudinaryLink: 'https://cloudinary.com',
  });
  await photo.$add('albums', album);
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
