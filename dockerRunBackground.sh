#!/bin/bash
sudo docker run -dit --restart='always' \
--name 'alpine-chromecast-data-watcher' \
--network host \
alpine-chromecast-data-watcher