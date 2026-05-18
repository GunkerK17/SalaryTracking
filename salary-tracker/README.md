# GoMom Salary Tracker

App theo dõi thu nhập USD (web + iOS Capacitor), đã tích hợp Supabase để lưu cloud.

## 1) Cấu hình Supabase

1. Tạo project trên Supabase.
2. Vào `SQL Editor`, chạy file [`supabase/schema.sql`](./supabase/schema.sql).
3. Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

4. Điền:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 2) Chạy local

```bash
npm install
npm run dev
```

## 3) Deploy GitHub Pages

```bash
npm run deploy
```

## 4) iOS (Capacitor)

```bash
npm run ios:sync
npm run ios:open
```

## Ghi chú quan trọng

- App đang dùng Supabase **không đăng nhập**, nên mọi ai có app + key đều có thể đọc/ghi chung dữ liệu.
- Nếu sau này cần riêng tư theo từng người dùng, nên thêm Supabase Auth + RLS theo `user_id`.
