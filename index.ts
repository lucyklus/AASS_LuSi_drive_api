import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import ws from 'ws';
import expressWs from 'express-ws';
import { Sequelize } from 'sequelize-typescript';
import { dynamicImport } from 'tsimportlib';

import { type ClientConfig } from 'camunda-external-task-client-js';

import { Photo } from './models/photo';
import { Album } from './models/album';
import { PhotoAlbum } from './models/photo_album';
import type { ICreateAlbumDTO, ICreatePhotoDTO, IUpdateAlbumDTO, IUpdatePhotoDTO } from './interfaces';

dotenv.config();

const { app } = expressWs(express());
const port = process.env.PORT ?? '3000';

expressWs(app);

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
    const photo1 = await Photo.create({
      name: 'My Photo 1',
      cloudinaryLink: 'https://picsum.photos/200/300',
    });
    const photo2 = await Photo.create({
      name: 'My Photo 2',
      cloudinaryLink: 'https://picsum.photos/200/300',
    });
    await photo1.$add('albums', album1);
    await photo2.$add('albums', album2);
  } catch (err) {
    console.log('Mockup failed');
  }
};

app.listen(port, async () => {
  await sequelize.sync();
  // await mockup();
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});

interface WsMessage {
  type: 'server' | 'upload' | 'notification' | 'photos';
  data?: any;
}

app.ws('/', async (ws, req) => {
  console.log('Ws started');
  console.log('Preparing camunda client');
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

  client.subscribe('approve-upload', async function ({ task, taskService }) {
    console.log('approve-upload');
    try {
      const message: WsMessage = {
        type: 'upload',
        data: {
          message: 'Are you sure you want to upload this photo?',
        },
      };
      ws.send(JSON.stringify(message));
      interface UploadResponse {
        upload: 'yes' | 'no';
        url?: string;
      }
      ws.on('message', async (msg: string) => {
        const response = JSON.parse(msg) as UploadResponse;
        if (response.upload === 'yes') {
          vars.set('save', 'yes');
          vars.set('cloudinaryLink', response.url);
        } else if (response.upload === 'no') {
          vars.set('save', 'no');
        }
        await taskService.complete(task, vars);
      });
    } catch (err) {
      console.log(err);
    }
  });

  client.subscribe('save-notification', async function ({ task, taskService }) {
    console.log('save-notification');
    const message: WsMessage = {
      type: 'notification',
      data: {
        message: 'Photo saved successfully',
      },
    };
    ws.send(JSON.stringify(message));
    await taskService.complete(task);
  });

  client.subscribe('return-photos', async function ({ task, taskService }) {
    console.log('return-photos');
    const photos = await Photo.findAll({ include: [Album] });
    vars.set('photos', photos);
    const message: WsMessage = {
      type: 'photos',
      data: {
        photos,
      },
    };
    ws.send(JSON.stringify(message));
    await taskService.complete(task, vars);
  });

  client.subscribe('save-photo', async function ({ task, taskService }) {
    console.log('save-photo');
    try {
      const name = task.variables.get('name');
      const cloudinaryLink = task.variables.get('cloudinaryLink');
      const photo = await Photo.create({ name, cloudinaryLink });
      vars.set('photoId', photo.id);
      await taskService.complete(task, vars);
    } catch (err) {
      console.log(err);
    }
  });

  const message: WsMessage = {
    type: 'server',
    data: {
      ready: true,
    },
  };

  ws.send(JSON.stringify(message));
});
