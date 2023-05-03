# How to work with Kafka

## Run docker compose
```sh
docker compose up -d
```

## Enter terminal

1. Open docker app
2. Click on image
3. Select terminal

## List existing topics

```sh
  kafka-topics.sh --list  --bootstrap-server 0.0.0.0:9092
```

## Create new topic

```sh
  kafka-topics.sh --create --topic albums.read --bootstrap-server 0.0.0.0:9092 &&
  kafka-topics.sh --create --topic albums.create --bootstrap-server 0.0.0.0:9092 &&
  kafka-topics.sh --create --topic albums.update --bootstrap-server 0.0.0.0:9092 &&
  kafka-topics.sh --create --topic albums.delete --bootstrap-server 0.0.0.0:9092 &&

  kafka-topics.sh --create --topic photos.read --bootstrap-server 0.0.0.0:9092 &&
  kafka-topics.sh --create --topic photos.create --bootstrap-server 0.0.0.0:9092 &&
  kafka-topics.sh --create --topic photos.update --bootstrap-server 0.0.0.0:9092 &&
  kafka-topics.sh --create --topic photos.delete --bootstrap-server 0.0.0.0:9092

```

## Delete a topic
```sh
  kafka-topics.sh --delete --topic operations --bootstrap-server 0.0.0.0:9092 
```
