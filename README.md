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
  kafka-topics.sh --create --topic new-topic --bootstrap-server 0.0.0.0:9092
```
