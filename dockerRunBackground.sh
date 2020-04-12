#!/bin/bash
sudo docker run -dit --restart='always' \
--network host \
alpine-chromecast-data-watcher