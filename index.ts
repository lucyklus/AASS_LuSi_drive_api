import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Sequelize } from 'sequelize-typescript';
import { dynamicImport } from 'tsimportlib';

import { type ClientConfig } from 'camunda-external-task-client-js';

import { Photo } from './models/photo';
import { Album } from './models/album';
import { PhotoAlbum } from './models/photo_album';
import type { ICreateAlbumDTO, ICreatePhotoDTO, IUpdateAlbumDTO, IUpdatePhotoDTO } from './interfaces';

dotenv.config();
(async () => {
  const { Client, logger, Variables } = (await dynamicImport(
    'camunda-external-task-client-js',
    module,
  )) as typeof import('camunda-external-task-client-js');

  const config: ClientConfig = {
    baseUrl: process.env.CAMUNDA_REST ?? 'http://localhost:8080/engine-rest',
    use: logger,
    asyncResponseTimeout: 10000,
  };

  const client = new Client(config);
  const vars = new Variables();

  client.subscribe('add-new-photo', async function ({ task, taskService }) {
    const name = task.variables.get('photoName');
    const cloudinaryLink = task.variables.get('cloudinaryLink');

    if (!name || !cloudinaryLink) {
      console.log('ADD_NEW_PHOTO > Invalid data provided');
      return await taskService.handleFailure(task, {
        errorMessage: 'Invalid data provided',
        errorDetails: 'Invalid data provided',
        retries: 0,
      });
    }

    const photo = await Photo.create({ name, cloudinaryLink });
    console.log('Photo created');

    vars.set('photoId', photo.id);
    await taskService.complete(task, vars);
  });

  client.subscribe('edit-photo-name', async function ({ task, taskService }) {
    const name = task.variables.get('newPhotoName');
    if (!name) {
      console.log('EDIT_PHOTO_NAME > Invalid data provided');
      return await taskService.handleFailure(task, {
        errorMessage: 'Invalid data provided',
        errorDetails: 'Invalid data provided',
        retries: 0,
      });
    }

    const photoFound = await Photo.findOne({ where: { id: vars.get('photoId') } });
    if (!photoFound) {
      console.log('EDIT_PHTO > Photo doesnt exist');
      return await taskService.handleFailure(task, {
        errorMessage: 'Invalid data provided',
        errorDetails: 'Invalid data provided',
        retries: 0,
      });
    }
    photoFound.setAttributes({ name });
    console.log('Photo name edited');
    await photoFound.save();
    await taskService.complete(task);
  });

  client.subscribe('create-album', async function ({ task, taskService }) {
    const name = 'New Album';
    const album = await Album.create({ name });
    console.log('Album created');
    vars.set('albumId', album.id);
    console.log('Album created');
    await taskService.complete(task);
  });

  client.subscribe('edit-album', async function ({ task, taskService }) {
    const id = vars.get('albumId');
    const name = task.variables.get('newAlbumName');
    if (!id || !name) {
      console.log('EDIT_ALBUM > Invalid data provided');
      return await taskService.handleFailure(task, {
        errorMessage: 'Invalid data provided',
        errorDetails: 'Invalid data provided',
        retries: 0,
      });
    }
    const albumFound = await Album.findOne({ where: { id } });
    if (!albumFound) {
      console.log('EDIT_ALBUM > Album doesnt exist');
      return await taskService.handleFailure(task, {
        errorMessage: 'Album not found',
        errorDetails: 'Album not found',
        retries: 0,
      });
    }

    albumFound.setAttributes({ name });
    await albumFound.save();
    console.log('Album edited');
    await taskService.complete(task);
  });

  client.subscribe('add-photo-to-album', async function ({ task, taskService }) {
    const id = vars.get('photoId');
    const albums = [vars.get('albumId')] as number[];
    const photoFound = await Photo.findOne({ where: { id } });
    if (!photoFound) {
      console.log('ADD_PHOTO_TO_ALBUM > Photo doesnt exist');
      return await taskService.handleFailure(task, {
        errorMessage: 'Photo not found',
        errorDetails: 'Photo not found',
        retries: 0,
      });
    }

    const dbAlbums = await Album.findAll({
      where: {
        id: albums,
      },
    });

    await photoFound.$set('albums', dbAlbums);
    await photoFound.save();
    await taskService.complete(task);
  });
})();

const app: Express = express();
const port = process.env.PORT ?? '3000';

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

  const dbAlbums = await Album.findAll({
    where: {
      id: albums,
    },
  });

  photoFound.setAttributes({ name });
  await photoFound.$set('albums', dbAlbums);
  await photoFound.save();
  res.send(photoFound);
});

app.post('/album', async (req: Request, res: Response) => {
  const { name } = req.body as ICreateAlbumDTO;
  const album = await Album.create({ name });
  res.send(album);
});
app.put('/album/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body as IUpdateAlbumDTO;
  const albumFound = await Album.findOne({ where: { id } });
  if (!albumFound) {
    return res.status(404).send({ error: 'Album not found' });
  }

  albumFound.setAttributes({ name });
  await albumFound.save();
  res.send(albumFound);
});

app.get('/albums', async (req: Request, res: Response) => {
  const albums = await Album.findAll();
  res.send(albums);
});

app.delete('/photo/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const photoFound = await Photo.findOne({ where: { id } });
  if (!photoFound) {
    return res.status(405).send({ error: 'Photo not found' });
  }
  await photoFound.destroy();
  res.send(`Photo with id: ${id} deleted`);
});

app.delete('/album/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const albumFound = await Album.findOne({ where: { id } });
  if (!albumFound) {
    return res.status(405).send({ error: 'Album not found' });
  }
  await albumFound.destroy();
  res.send(`Album with id: ${id} deleted`);
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
