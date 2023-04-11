import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Sequelize } from 'sequelize-typescript';

import { Photo } from './models/photo';
import { Album } from './models/album';
import { PhotoAlbum } from './models/photo_album';
import { ICreateAlbumDTO, ICreatePhotoDTO, IUpdatePhotoDTO } from './interfaces';
import { Op } from 'sequelize';

dotenv.config();

const app: Express = express();
const port = process.env.PORT;

app.use(express.json());
app.use(
  cors({
    origin: '*',
  }),
);

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './db/db.sqlite',
});
sequelize.addModels([Photo, Album, PhotoAlbum]);

app.post('/photo', async (req: Request, res: Response) => {
  const { name, cloudinaryLink } = req.body as ICreatePhotoDTO;
  try {
    const photo = await Photo.create({ name, cloudinaryLink });
    return res.send(photo);
  } catch (err) {
    console.log(err);
  }
  return res.status(400).send({ error: 'Invalid data provided' });
});

app.get('/photos', async (req: Request, res: Response) => {
  const photos = await Photo.findAll({ include: [Album] });
  return res.send(photos);
});

app.get('/:albumId/photos', async (req: Request, res: Response) => {
  const { albumId } = req.params;
  const albumFound = await Album.findOne({ where: { id: albumId } });
  if (!albumFound) {
    return res.status(404).send({ error: 'Album not found' });
  }
  const photos = await albumFound.$get('photos', { include: [Album] });
  res.send(photos);
});

app.put('/photo/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, albums } = req.body as IUpdatePhotoDTO;
  const photoFound = await Photo.findOne({ where: { id } });
  if (!photoFound) {
    return res.status(404).send({ error: 'Photo not found' });
  }

  console.log('ALBUMS: ', albums);

  const dbAlbums = await Album.findAll({
    where: {
      id: albums,
    },
  });

  photoFound.name = name;
  await photoFound.$set('albums', dbAlbums);
  await photoFound.save();
  res.send(photoFound);
});

app.post('/album', async (req: Request, res: Response) => {
  const { name } = req.body as ICreateAlbumDTO;
  const album = await Album.create({ name });
  res.send(album);
});

app.get('/albums', async (req: Request, res: Response) => {
  const albums = await Album.findAll();
  res.send(albums);
});

const mockup = async () => {
  try {
    await sequelize.sync();

    const album1 = await Album.create({ name: 'My Album 1' });
    const album2 = await Album.create({ name: 'My Album 2' });
    const album3 = await Album.create({ name: 'My Album 3' });
    const album4 = await Album.create({ name: 'My Album 4' });
    const photo1 = await Photo.create({
      name: 'My Photo 1',
      cloudinaryLink: 'https://picsum.photos/200/300',
    });
    const photo2 = await Photo.create({
      name: 'My Photo 2',
      cloudinaryLink: 'https://picsum.photos/200/300',
    });
    const photo3 = await Photo.create({
      name: 'My Photo 3',
      cloudinaryLink: 'https://picsum.photos/200/300',
    });
    await photo1.$add('albums', album1);
    await photo2.$add('albums', album1);
    await photo3.$add('albums', album1);
  } catch (err) {
    console.log('Mockup failed');
  }
};

app.listen(port, async () => {
  await mockup();
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
