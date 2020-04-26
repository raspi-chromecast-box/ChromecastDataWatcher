FROM node:latest

COPY ChromecastDataWatcher.js /home/

WORKDIR "/home/"

RUN npm init -y
RUN npm install castv2-client --save
RUN npm install events --save
RUN npm install redis-manager-utils --save

ENTRYPOINT [ "node" , "/home/ChromecastDataWatcher.js" ]