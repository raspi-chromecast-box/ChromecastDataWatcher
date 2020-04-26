#!/bin/bash
sudo docker run -it \
--name 'alpine-chromecast-data-watcher' \
--network host \
alpine-chromecast-data-watcher