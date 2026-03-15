# RMonitor Converter - Development Worklog

## Project Overview
RMonitor Converter - конвертер данных между протоколом RMonitor (TCP) и WebJSON (WebSocket).

---
Task ID: 1
Agent: Main Architect
Task: Проектирование структуры проекта и архитектуры

Work Log:
- Анализ требований из TZ-2.md
- Проектирование модульной архитектуры с использованием паттернов
- Определение структуры папок для масштабирования

Stage Summary:
- Архитектура спроектирована с разделением на модули

---
Task ID: 2
Agent: Database Developer
Task: Создание схемы базы данных Prisma

Work Log:
- Создание схемы Prisma с 25 моделями
- Модели для аутентификации, конфигурации, логирования и данных RMonitor

Stage Summary:
- База данных SQLite создана и синхронизирована

---
Task ID: 3
Agent: Backend Developer
Task: Разработка Converter Service (mini-service)

Work Log:
- Создание Converter Service на портах 50003 (WS) и 50004 (Management API)
- Реализация RMonitorStreamParser для парсинга TCP пакетов
- Реализация конвертера RMonitor ↔ WebJSON
- Создание CacheManager для кэширования сообщений init-блока
- Создание TcpClientManager и WebSocketServerManager

Stage Summary:
- Converter Service полностью функционален

---
Task ID: 4-8
Agent: Frontend Developer
Task: Разработка Web Panel

Work Log:
- Создание Layout компонентов (Sidebar, Header)
- Создание Dashboard, TCP Sources, WS Servers, Roles, API Keys, Settings вкладок
- Создание API routes для всех сущностей

Stage Summary:
- Web Panel готова к использованию

---
Task ID: 9-10 (Update)
Agent: Full-Stack Developer
Task: Добавление авторизации и вкладки Database

Work Log:
- Создание системы авторизации:
  - `/api/auth` - API для login/logout/session/setup
  - `/login` - Страница авторизации
  - Middleware для защиты роутов
  - Seed для создания начального админа (admin@rmonitor.local / admin)
- Создание вкладки Database:
  - Настройка подключения к MySQL/PostgreSQL
  - Выбор команд для логирования ($A, $B, $C, etc.)
  - Включение/выключение логирования команд

Stage Summary:
- Авторизация полностью функциональна
- Вкладка Database позволяет настроить удаленную БД
- API login доступен без авторизации (PUBLIC_PATHS в middleware)

---
Task ID: 11
Agent: Full-Stack Developer
Task: Исправление удаленной БД и динамическое управление WS серверами

Work Log:
- Добавлена модель ConverterSettings в Prisma схему converter-service
- Исправлены модели ApiKey (isActive вместо isEnabled), WsServer, TcpSource, WsServerTcpMapping
- Создан lib/prisma.ts для singleton доступа к Prisma клиенту
- Добавлены API endpoints для динамического управления WS серверами:
  - POST /api/ws/servers - создание/запуск WS сервера
  - DELETE /api/ws/servers/:id - остановка WS сервера
  - POST /api/remote-db/reload - перезагрузка настроек удаленной БД
- Обновлены API routes в Next.js для уведомления converter-service:
  - Создание/обновление/удаление WS серверов без перезагрузки
  - Сохранение настроек БД применяются мгновенно

Stage Summary:
- Remote database теперь корректно подключается и создает таблицы
- WS серверы можно добавлять/удалять без перезагрузки приложения
- Настройки database применяются мгновенно через API notifyConverterReload

## Структура проекта

```
/home/z/my-project/
├── prisma/
│   └── schema.prisma          # Схема БД (25 моделей)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/route.ts       # Auth API (login/logout/session)
│   │   │   ├── seed/route.ts       # Seed initial admin
│   │   │   ├── converter/[...path] # Proxy к Converter Service
│   │   │   ├── tcp-sources/        # TCP Sources CRUD
│   │   │   ├── ws-servers/         # WS Servers CRUD
│   │   │   ├── roles/              # Roles CRUD
│   │   │   ├── api-keys/           # API Keys CRUD
│   │   │   └── database-settings/  # Database settings CRUD
│   │   ├── login/page.tsx          # Login page
│   │   ├── page.tsx                # Главная страница
│   │   ├── layout.tsx              # Layout
│   │   └── middleware.ts           # Auth middleware
│   ├── lib/
│   │   └── auth.ts                 # Auth utilities
│   └── components/
│       ├── layout/                 # Sidebar, Header
│       ├── dashboard/              # Dashboard tab
│       ├── tcp-sources/            # TCP Sources tab
│       ├── ws-servers/             # WS Servers tab
│       ├── roles/                  # Roles tab
│       ├── settings/               # API Keys, Settings tabs
│       └── database/               # Database settings tab
└── mini-services/
    └── converter-service/
        └── src/                    # Converter service code
```

## Учетные данные по умолчанию

- **Email:** admin@rmonitor.local
- **Password:** admin

## Порты

| Сервис | Порт | Назначение |
|--------|------|------------|
| Web Panel | 3000 | Next.js веб-панель |
| Converter WS | 50003 | WebSocket сервер |
| Converter API | 50004 | Management API |

## Поддерживаемые команды RMonitor

$I, $E, $B, $C, $A, $COMP, $G, $H, $J, $F, $DPD, $DPF, $DSI

## Публичные роуты (без авторизации)

- `/login` - Страница авторизации
- `/api/auth` - API авторизации
- `/api/seed` - Создание начального админа
