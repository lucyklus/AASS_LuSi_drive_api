import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Sequelize } from 'sequelize-typescript';
import { Kafka } from 'kafkajs';
import expressWs from 'express-ws';

import { Photo } from './models/photo';
import { Album } from './models/album';
import { PhotoAlbum } from './models/photo_album';
import { ICreateAlbumDTO, ICreatePhotoDTO, IUpdateAlbumDTO, IUpdatePhotoDTO } from './interfaces';
import WebSocket from 'ws';

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['localhost:9092'],
});

const producer = kafka.producer();

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

type OperationType = 'photos' | 'albums';
type OperationKind = 'create' | 'update' | 'delete' | 'read';
interface IOperation<Type extends OperationType, Kind extends OperationKind> {
  type: Type;
  kind: Kind;
  data: Type extends 'photos'
    ? Kind extends 'create'
      ? ICreatePhotoDTO
      : Kind extends 'update'
      ? IUpdatePhotoDTO & { id: string }
      : Kind extends 'delete'
      ? { id: string }
      : { id?: string }
    : Kind extends 'create'
    ? ICreateAlbumDTO
    : Kind extends 'update'
    ? IUpdateAlbumDTO & { id: string }
    : Kind extends 'delete'
    ? { id: string }
    : undefined;
}

app.post('/photo', async (req: Request, res: Response) => {
  const { name, cloudinaryLink } = req.body as ICreatePhotoDTO;
  await producer.connect();
  const operation: IOperation<'photos', 'create'> = {
    type: 'photos',
    kind: 'create',
    data: { name, cloudinaryLink },
  };
  await producer.send({
    topic: 'operations',
    messages: [{ value: JSON.stringify(operation) }],
  });
  await producer.disconnect();
  return res.send();
});

app.get('/photos', async (req: Request, res: Response) => {
  await producer.connect();
  const operation: IOperation<'photos', 'read'> = {
    type: 'photos',
    kind: 'read',
    data: {},
  };
  await producer.send({
    topic: 'operations',
    messages: [{ value: JSON.stringify(operation) }],
  });
  await producer.disconnect();
  return res.sendStatus(200);
});

app.get('/:albumId/photos', async (req: Request, res: Response) => {
  const { albumId } = req.params;
  await producer.connect();
  const operation: IOperation<'photos', 'read'> = {
    type: 'photos',
    kind: 'read',
    data: { id: albumId },
  };
  await producer.send({
    topic: 'operations',
    messages: [{ value: JSON.stringify(operation) }],
  });
  await producer.disconnect();
  return res.send();
});

app.put('/photo/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, albums } = req.body as IUpdatePhotoDTO;
  await producer.connect();
  const operation: IOperation<'photos', 'update'> = {
    type: 'photos',
    kind: 'update',
    data: { id, name, albums },
  };
  await producer.send({
    topic: 'operations',
    messages: [{ value: JSON.stringify(operation) }],
  });
  await producer.disconnect();
  return res.send();
});

app.post('/album', async (req: Request, res: Response) => {
  const { name } = req.body as ICreateAlbumDTO;
  await producer.connect();
  const operation: IOperation<'albums', 'create'> = {
    type: 'albums',
    kind: 'create',
    data: { name },
  };
  await producer.send({
    topic: 'operations',
    messages: [{ value: JSON.stringify(operation) }],
  });
  await producer.disconnect();
  return res.send();
});
app.put('/album/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body as IUpdateAlbumDTO;
  await producer.connect();
  const operation: IOperation<'albums', 'update'> = {
    type: 'albums',
    kind: 'update',
    data: { id, name },
  };
  await producer.send({
    topic: 'operations',
    messages: [{ value: JSON.stringify(operation) }],
  });
  await producer.disconnect();
  return res.send();
});

app.get('/albums', async (req: Request, res: Response) => {
  await producer.connect();
  const operation: IOperation<'albums', 'read'> = {
    type: 'albums',
    kind: 'read',
    data: undefined,
  };
  await producer.send({
    topic: 'operations',
    messages: [{ value: JSON.stringify(operation) }],
  });
  await producer.disconnect();
  return res.send();
});

app.delete('/photo/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await producer.connect();
  const operation: IOperation<'photos', 'delete'> = {
    type: 'photos',
    kind: 'delete',
    data: { id },
  };
  await producer.send({
    topic: 'operations',
    messages: [{ value: JSON.stringify(operation) }],
  });
  await producer.disconnect();
  return res.send();
});

app.delete('/album/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await producer.connect();
  const operation: IOperation<'albums', 'delete'> = {
    type: 'albums',
    kind: 'delete',
    data: { id },
  };
  await producer.send({
    topic: 'operations',
    messages: [{ value: JSON.stringify(operation) }],
  });
  await producer.disconnect();
  return res.send();
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

const consumer = kafka.consumer({ groupId: 'server-group' });

app.listen(port, async () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
  await mockup();
  console.log(`⚡️[server]: Database mocked up`);
  await consumer.connect();
  await consumer.subscribe({ topic: 'operations', fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message }) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const data = JSON.parse(message.value!.toString());
      console.log('Data: ', data);
      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const operation: { type: OperationType; kind: OperationKind } = data as any;
        if (operation.type == 'photos') {
          if (operation.kind == 'create') {
            const { name, cloudinaryLink } = (operation as IOperation<'photos', 'create'>).data;
            const photo = await Photo.create({ name, cloudinaryLink });
            console.log('Photo created', photo.id);
            return;
          }
          if (operation.kind == 'update') {
            const { id, name, albums } = (operation as IOperation<'photos', 'update'>).data;
            const photoFound = await Photo.findOne({ where: { id } });
            if (!photoFound) {
              return globalWs?.send(JSON.stringify({ error: 'Photo not found' }));
            }
            const dbAlbums = await Album.findAll({
              where: {
                id: albums,
              },
            });
            photoFound.setAttributes({ name });
            await photoFound.$set('albums', dbAlbums);
            await photoFound.save();
            console.log('Photo updated', photoFound.id);
            return;
          }
          if (operation.kind == 'delete') {
            const { id } = (operation as IOperation<'photos', 'delete'>).data;
            const photoFound = await Photo.findOne({ where: { id } });
            if (!photoFound) {
              return globalWs?.send(JSON.stringify({ error: 'Photo not found' }));
            }
            await photoFound.destroy();
            console.log('Photo deleted', photoFound.id);
            return;
          }
          if (operation.kind == 'read') {
            const { id } = (operation as IOperation<'photos', 'read'>).data;
            let photos = [];
            if (!id) {
              photos = await Photo.findAll({ include: [Album] });
            } else {
              const album = await Album.findOne({ where: { id } });
              if (!album) {
                return globalWs?.send(JSON.stringify({ error: 'Album not found' }));
              }
              photos = await album.$get('photos', { include: [Album] });
            }
            console.log('Photos read', photos.length);
            return globalWs?.send(JSON.stringify({ type: 'photos', data: photos }));
          }
        }
        if (operation.type == 'albums') {
          if (operation.kind == 'create') {
            const { name } = (operation as IOperation<'albums', 'create'>).data;
            const album = await Album.create({ name });
            console.log('Album created', album.id);
            return;
          }
          if (operation.kind == 'update') {
            const { id, name } = (operation as IOperation<'albums', 'update'>).data;
            const albumFound = await Album.findOne({ where: { id } });
            if (!albumFound) {
              return globalWs?.send(JSON.stringify({ error: 'Album not found' }));
            }
            albumFound.setAttributes({ name });
            await albumFound.save();
            console.log('Album updated', albumFound.id);
            return;
          }
          if (operation.kind == 'delete') {
            const { id } = (operation as IOperation<'albums', 'delete'>).data;
            const albumFound = await Album.findOne({ where: { id } });
            if (!albumFound) {
              return globalWs?.send(JSON.stringify({ error: 'Album not found' }));
            }
            await albumFound.destroy();
            console.log('Album deleted', albumFound.id);
            return;
          }
          if (operation.kind == 'read') {
            const albums = await Album.findAll();
            console.log('Albums read', albums.length);
            return globalWs?.send(JSON.stringify({ type: 'albums', data: albums }));
          }
        }
      }
      console.log({
        value: message.value,
      });
    },
  });
  console.log(`⚡️[server]: Consumer is running`);
});

let globalWs: WebSocket | null = null;

app.ws('/', async (ws, req) => {
  globalWs = ws;
  console.log('⚡️[ws]: Client connected');
});
