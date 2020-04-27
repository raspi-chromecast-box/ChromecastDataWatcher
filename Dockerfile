FROM node:latest

RUN npm install castv2-client -g
RUN npm install events -g
RUN npm install redis-manager-utils -g
RUN npm install bent -g

COPY ChromecastDataWatcher.js /home/

ENTRYPOINT [ "node" , "/home/ChromecastDataWatcher.js" ]