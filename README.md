# RMonitor Converter

Конвертер данных между протоколом RMonitor (TCP) и WebJSON (WebSocket).

## 🚀 Быстрый старт

### Требования

- **Bun** 1.0+ (рекомендуется) или **Node.js** 18+
- **Git**

### Установка и инициализация

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/Striagor/RMonitor-Converter.git
cd RMonitor-Converter

# 2. Запустите инициализатор (интерактивный режим)
bun run init.ts

# ИЛИ используйте значения по умолчанию (без запросов)
bun run init.ts --defaults
```

Инициализатор выполняет:
- ✅ Установку всех зависимостей (основной проект + converter service)
- ✅ Создание базы данных SQLite
- ✅ Создание роли по умолчанию для WebSocket клиентов
- ✅ Создание администратора

---

## 🖥️ Запуск

### Способ 1: Скрипт start.sh (рекомендуется)

```bash
# Запуск в фоновом режиме (daemon mode)
bash start.sh

# Или если есть права на выполнение
./start.sh

# Запуск в режиме разработки (с логами в консоли)
bash start.sh --dev

# Остановка всех сервисов
bash stop.sh
```

### Способ 2: Вручную (два терминала)

**Важно:** Запускайте сервисы в указанном порядке!

**Терминал 1 - Converter Service (ЗАПУСТИТЬ ПЕРВЫМ):**
```bash
cd mini-services/converter-service
bun run dev
```

**Терминал 2 - Web Panel:**
```bash
bun run dev
```

### Способ 3: PM2 (Production)

```bash
# Установка PM2
bun add -g pm2

# Запуск через ecosystem config
pm2 start ecosystem.config.js

# Просмотр логов
pm2 logs

# Сохранение конфигурации (автозапуск при перезагрузке)
pm2 save
pm2 startup
```

### Способ 4: Systemd (Linux Production)

```bash
# Установка как системный сервис
sudo bun run deploy/install-systemd.sh

# Управление
sudo systemctl status rmonitor-converter
sudo systemctl status rmonitor-panel
sudo systemctl restart rmonitor-converter
sudo journalctl -u rmonitor-converter -f
```

---

## 🌐 Доступ

| Сервис | Адрес | Описание |
|--------|-------|----------|
| Web Panel | http://localhost:3000 | Веб-интерфейс управления |
| WebSocket | ws://localhost:50003 | Для подключения клиентов |
| Management API | http://localhost:50004 | API для управления |

---

## 🔑 Учетные данные по умолчанию

| Поле | Значение |
|------|----------|
| Email | `admin@rmonitor.local` |
| Password | `admin` |

⚠️ **Измените пароль после первого входа!**

---

## 📁 Структура проекта

```
├── start.sh              # Запуск всех сервисов
├── stop.sh               # Остановка всех сервисов
├── init.ts               # Инициализатор проекта
├── ecosystem.config.js   # PM2 конфигурация
├── deploy/               # Файлы для deployment
│   ├── install-systemd.sh
│   ├── rmonitor-converter.service
│   └── rmonitor-panel.service
├── prisma/
│   └── schema.prisma     # Схема базы данных
├── src/
│   ├── app/              # Next.js страницы и API
│   ├── components/       # UI компоненты
│   └── lib/              # Утилиты
└── mini-services/
    └── converter-service/  # Сервис конвертера
```

---

## 🔧 Скрипты

```bash
# Инициализация
bun run init.ts              # Интерактивная
bun run init.ts --defaults   # Без запросов

# Запуск (через bash!)
bash start.sh                # Daemon mode
bash start.sh --dev          # Development mode
bash stop.sh                 # Остановка

# База данных
bun run db:generate          # Генерация Prisma клиента
bun run db:push              # Создание таблиц

# Другое
bun run lint                 # Проверка кода
```

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    RMONITOR CONVERTER                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           WEB PANEL (Next.js - порт 3000)             │  │
│  │                                                       │  │
│  │  Dashboard │ TCP Sources │ WS Servers │ Roles │ etc  │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                 │
│                           ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         CONVERTER SERVICE (Bun - порт 50003/50004)    │  │
│  │                                                       │  │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐        │  │
│  │  │   TCP    │    │Converter │    │    WS    │        │  │
│  │  │  Client  │───▶│  Engine  │───▶│  Server  │        │  │
│  │  │ RMonitor │    │ RMonitor │    │ WebJSON  │        │  │
│  │  │ Protocol │◀───│   ↔      │◀───│ Protocol │        │  │
│  │  └──────────┘    │ WebJSON  │    └──────────┘        │  │
│  │                  └──────────┘                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📡 Поддерживаемые команды RMonitor

| Команда | Описание | WebJSON поля |
|---------|----------|--------------|
| `$I` | Инициализация сессии | `TimeOfDay`, `Date` |
| `$A` | Регистрация участника | `RegistrationNumber`, `Number`, `TransponderNumber`, `FirstName`, `LastName`, `Nationality`, `ClassNumber` |
| `$COMP` | Информация об участнике | Те же поля + `AdditionalData` |
| `$G` | Позиция в гонке | `Position`, `RegistrationNumber`, `Laps`, `TotalTime` |
| `$H` | Лучший круг | `Position`, `RegistrationNumber`, `BestLap`, `BestLaptime` |
| `$J` | Время круга | `RegistrationNumber`, `Laptime`, `TotalTime` |
| `$F` | Статус гонки | `LapsToGo`, `TimeToGo`, `TimeOfDay`, `RaceTime`, `FlagStatus` |
| `$B` | Описание линии | `UniqueNumber`, `Description` |
| `$C` | Описание класса | `UniqueNumber`, `Description` |
| `$E` | Дополнительные данные | `Description`, `Value` |
| `$DPD` | Данные декодера | `DECODER_ID`, `TRANSPONDER`, `RTC_TIME`, ... |
| `$DPF` | Полные данные декодера | Все поля декодера |
| `$DSI` | Данные скорости | `RegistrationNumber`, `Speed`, `TimeOfStay` |

---

## 🔐 Авторизация

### Web Panel

Страница входа: `/login`

### WebSocket клиенты

1. Создайте роль во вкладке **Roles**
2. Создайте API ключ во вкладке **API Keys**
3. Подключайтесь с ключом:
```
ws://localhost:50003?apiKey=rm_xxxxx
```

---

## 🗄️ База данных

### SQLite (по умолчанию)

База данных создается автоматически в `db/custom.db`

### MySQL / PostgreSQL

1. Откройте вкладку **Database**
2. Включите **Use Remote Database**
3. Настройте подключение:
   - Host, Port, Database Name
   - Username, Password
4. Нажмите **Test Connection**
5. Сохраните настройки
6. Перезапустите сервисы

---

## 📝 Форматы данных

### RMonitor → WebJSON

**Вход (RMonitor):**
```
$A,"74","74",9032474,"Marc","Marquez","ESP",1
```

**Выход (WebJSON):**
```json
{
  "Id": "A",
  "RegistrationNumber": "74",
  "Number": "74",
  "TransponderNumber": "9032474",
  "FirstName": "Marc",
  "LastName": "Marquez",
  "Nationality": "ESP",
  "ClassNumber": "1"
}
```

---

## 🛡️ Безопасность

- ✅ Хеширование паролей (SHA-256 + salt)
- ✅ Сессии с ограничением времени (24 часа)
- ✅ Middleware для защиты роутов
- ✅ API ключи для WebSocket клиентов
- ✅ Ролевая модель доступа

---

## ❓ Решение проблем

### Ошибка "Cannot find module @prisma/client"

```bash
bun run db:generate
```

### Ошибка "Database not found"

```bash
bun run db:push
```

### Converter Service не запускается

Проверьте, что порты 50003 и 50004 свободны:
```bash
lsof -i :50003
lsof -i :50004
```

### Не могу авторизоваться

1. Проверьте, что администратор создан:
   ```bash
   bun -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.adminUser.findMany().then(console.log)"
   ```
2. Если пусто, запустите инициализатор снова.

### Web Panel показывает "Converter Service Offline"

Запустите converter service первым:
```bash
cd mini-services/converter-service && bun run dev
```

---

## 📄 Лицензия

MIT License
