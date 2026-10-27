Lampa Transmission: работа без сервера на компьютере

Статус: подготовлены исходники, изменения и GitHub Actions. APK ещё не собран
и не проверен на приставке. Текущий рабочий патч v1.3 отдельно сохранён.

Основа Android: https://github.com/lampa-app/LAMPA, tag v1.13.5,
commit f6d9a9318a889b53edccd81fbe7050ec17dfd2ba.

Http.java передаёт запросы через новый TransmissionRpc.java. Только ответ 409
на /transmission/rpc с заголовком X-Transmission-Session-Id вызывает один повтор.
Повтор сохраняет метод, тело и остальные заголовки. Ответ после редиректа не
повторяется. Проверки пароля, CSRF и TLS остаются в силе.

APK имеет отдельный пакет top.rootu.lampa.transmission и имя Lampa Transmission.
Он устанавливается рядом с исходной Lampa. Настройки и расширения нужно настроить
в новом приложении; не удаляйте прежнюю рабочую Lampa.

Публикация:
1. Создать репозиторий GitHub и загрузить содержимое ЭТОЙ папки в корень.
   Включить скрытую папку .github с двумя workflow.
2. Actions -> Build Lampa Transmission APK -> Run workflow.
3. После успешных тестов и сборки скачать артефакт lampa-transmission-apk.
4. Settings -> Pages -> Source: GitHub Actions.
5. Actions -> Publish JavaScript extension -> Run workflow.
6. URL расширения: https://ИМЯ.github.io/РЕПОЗИТОРИЙ/transmission-native-fix.js

Установка и проверка:
1. Установить новый APK рядом с существующей Lampa.
2. Адрес запуска новой Lampa: http://bylampa.online
3. Добавить обычный LME Torrent Manager:
   https://lampame.github.io/main/torrentmanager/torrentmanager.js
4. Добавить расширение со страницы GitHub Pages из пункта 6.
5. Выбрать Transmission, Address: http://127.0.0.1:9091, логин/пароль пустые.
6. Transmission BTC: UPnP MediaServer включён, HTTP-порт 9092.
7. Проверить список и Смотреть скачанное; затем остановить сервер на компьютере
   и повторить проверку после перезапуска Transmission и Lampa.

Этот workflow создаёт debug APK для проверки. Ключ debug-подписи GitHub runner
может меняться между запусками. Для стабильных последующих обновлений требуется
собственный постоянный ключ подписи; не публикуйте его в репозитории.

Здесь нет учётных данных, Session ID и локального сервера. GitHub Pages раздаёт
только JavaScript. Получение сессии и видео выполняется на приставке.
Воспроизведение использует встроенный HTTP-сервер Transmission BTC.
