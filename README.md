# Chromecast Data Watcher

## Docker Build Command

```
sudo docker build -t alpine-chromecast-data-watcher .
```

## Docker Run Command
```
sudo docker run -dit --restart='always' \
--name 'alpine-chromecast-data-watcher' \
--network host \
alpine-chromecast-data-watcher
```