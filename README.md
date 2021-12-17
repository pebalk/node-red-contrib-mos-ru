# node-red-contrib-mos-ru

> Нода NodeRED для передачи показаний счетчиков учета воды и электроэнергии через портал https://www.mos.ru/.

## Начало работы

Данные получают через ноды waterGet и energyGet.
Передача показаний через массивы (Array):

```
msg.water -> waterSet
msg.energy -> energySet
```
Пример:
```
msg.water = [12,34,56,78];
msg.energy = [123,456,789];
```
Необходимо предварительно установить Chromium и указать место его установки через `msg.executablePath`. По умолчанию установлено: `/usr/bin/chromium-browser` .

Ноды pwdReset и pwdUpdate используются для сброса пароля на mos.ru и его восстановления с использованием электронной почты. Для восстановления пароля на вход ноды pwdUpdate необходимо подать msg.url с адресом, полученным на электронную почту. Для автоматизации процесса удобно использовать `node-red-node-email`.


-----

## Для использования с Alpine Docker

```
# Dockerfile

RUN set -x \
    && apk update \
    && apk upgrade \
    && apk add --no-cache \
    ttf-freefont \
    chromium \
    # Cleanup
    && apk del --no-cache make gcc g++ python binutils-gold gnupg libstdc++ \
    && rm -rf /usr/include \
    && rm -rf /var/cache/apk/* /root/.node-gyp /usr/share/man /tmp/* \
    && echo
```

-----

## Для использования

Данные задаются непосредственно в настройках нод или через передачу параметров через msg. Подробнее в разделе помощи каждой ноды. 