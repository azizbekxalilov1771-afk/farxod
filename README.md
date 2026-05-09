# 🤖 ZAFAR AI — O'zbek Android Yordamchi

## Loyiha tuzilmasi
```
ZafarAI/
├── app/src/main/
│   ├── java/com/zafar/ai/
│   │   ├── MainActivity.kt              ← Asosiy ekran + AI logika
│   │   ├── ZafarAccessibilityService.kt ← Tizim boshqaruv
│   │   ├── ZafarNotificationService.kt  ← Bildirmalar o'qish
│   │   ├── ZafarBackgroundService.kt    ← Fon xizmati
│   │   └── ChatAdapter.kt              ← Chat UI
│   ├── res/
│   │   ├── layout/                     ← XML layoutlar
│   │   ├── values/                     ← Ranglar, matnlar
│   │   ├── xml/                        ← Accessibility config
│   │   └── drawable/                   ← UI elementlar
│   └── AndroidManifest.xml             ← Ruxsatlar
├── build.gradle
└── settings.gradle
```

## O'rnatish bosqichlari

### 1. Android Studio o'rnating
https://developer.android.com/studio dan yuklab oling

### 2. API kalitni kiriting
`MainActivity.kt` faylida:
```kotlin
private val API_KEY = "YOUR_ANTHROPIC_API_KEY"
```
Bu yerga https://console.anthropic.com dan olingan API kalitni kiriting

### 3. Icon rasmlar qo'shing
`res/mipmap-hdpi/` papkasiga:
- `ic_launcher.png` (72x72px)
- `ic_launcher_round.png` (72x72px)

Va `res/drawable/` ga:
- `ic_mic.xml` — mikrofon icon
- `ic_mic_active.xml` — faol mikrofon icon  
- `ic_send.xml` — yuborish icon

### 4. Android Studio da oching
File → Open → ZafarAI papkasini tanlang

### 5. Qurilmaga o'rnating
- Telefonni USB bilan ulang
- Developer Mode yoqing
- Run tugmasini bosing

## Telefonni sozlash (birinchi ishga tushganda)

### Maxsus imkoniyatlar (Accessibility)
```
Sozlamalar → Maxsus imkoniyatlar → O'rnatilgan ilovalar → ZAFAR AI → Yoqish
```

### Bildirmalar ruxsati
```
Sozlamalar → Ilovalar → Maxsus kirish → Bildirismalarga kirish → ZAFAR AI
```

### Ekran ustida ko'rsatish
```
Sozlamalar → Ilovalar → Maxsus kirish → Ekran ustida ko'rsatish → ZAFAR AI
```

## Buyruqlar ro'yxati

### 📱 Qo'ng'iroq
- "Anvarga qo'ng'iroq qil"
- "998901234567 raqamga zang ur"

### 💬 SMS
- "Botirga xabar yubor: ertaga kelaman"
- "Onaga SMS: sog'lom bo'l"

### 📲 Ilovalar
- "WhatsApp'ni och"
- "YouTube'ni ishga tushir"
- "Telegramni yop"
- "Instagramni ko'rsat"

### 🔊 Ovoz
- "Ovozni ko'tar"
- "Ovozni pasayt"
- "Jimjit qil / Ovozsiz qil"

### 🔦 Fonar
- "Fonarni yoq"
- "Chiroqni o'chir"

### 🔋 Batareya
- "Batareya necha foiz?"
- "Zaryad holatini ayt"

### 📸 Kamera
- "Rasm ol"
- "Kamerani och"

### ⚙️ Sozlamalar
- "Sozlamalarni och"
- "Wi-Fi sozlamalarini ko'rsat"
- "Bluetooth'ni yoq"

## Texnik talablar
- Android 7.0 (API 24) yoki yuqori
- Internet ulanishi
- Anthropic API kaliti
- Mikrofon (ovozli buyruqlar uchun)

## Litsenziya
MIT License — erkin foydalaning va o'zgartiring
