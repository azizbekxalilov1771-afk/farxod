import telebot
from telebot import types
import sqlite3
import re

# Bot tokeningiz
API_TOKEN = "8939751313:AAESkxyojv9o8FhFBQP1CpaXvRvjKUUCZnA"
bot = telebot.TeleBot(API_TOKEN)

# --- ADMINNING SHAXSIY ID RAQAMI ---
ADMIN_ID = "7569778806" 

# --- BAZA BILAN ISHLASH ---
conn = sqlite3.connect("bot_users.db", check_same_thread=False)
cursor = conn.cursor()
cursor.execute("""
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    name TEXT,
    phone TEXT,
    gmail TEXT
)
""")
conn.commit()


# --- TUGMALAR ---

def get_phone_keyboard():
    keyboard = types.ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
    keyboard.add(types.KeyboardButton("📱 Raqamni yuborish", request_contact=True))
    return keyboard

def get_main_menu():
    keyboard = types.ReplyKeyboardMarkup(resize_keyboard=True)
    keyboard.add(types.KeyboardButton("💰 Balansni toʻldirish"), types.KeyboardButton("💸 Yechib olish"))
    keyboard.add(types.KeyboardButton("📜 Oʻtkazmalar tarixi"), types.KeyboardButton("👨‍💻 Murojaat"))
    return keyboard

def get_casinos_keyboard():
    keyboard = types.InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        types.InlineKeyboardButton("1win 🟢", callback_data="casino_1win"),
        types.InlineKeyboardButton("1xbet 🔵", callback_data="casino_1xbet"),
        types.InlineKeyboardButton("Melbet 🟡", callback_data="casino_melbet"),
        types.InlineKeyboardButton("Pin-up 🔴", callback_data="casino_pinup"),
        types.InlineKeyboardButton("🎰 Boshqa kazinolar", callback_data="casino_other")
    )
    return keyboard

# Admin uchun Tasdiqlash/Rad etish tugmalari
def get_admin_buttons(client_id, casino_name, casino_id):
    keyboard = types.InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        types.InlineKeyboardButton("✅ Tasdiqlash", callback_data=f"accept_{client_id}_{casino_name}_{casino_id}"),
        types.InlineKeyboardButton("❌ Rad etish", callback_data=f"reject_{client_id}")
    )
    return keyboard


# --- RO'YXATDAN O'TISH BOSQICHLARI ---

@bot.message_handler(commands=['start', 'restart'])
def cmd_start(message):
    user_id = message.chat.id
    bot.send_message(user_id, "Assalomu alaykum! Botga xush kelibsiz. 🎉", reply_markup=types.ReplyKeyboardRemove())
    
    sent_msg = bot.send_message(user_id, "Roʻyxatdan oʻtish uchun ism va familiyangizni kiriting:")
    bot.register_next_step_handler(sent_msg, process_name)

def process_name(message):
    name = message.text
    user_id = message.chat.id
    
    if len(name) < 3:
        sent_msg = bot.send_message(user_id, "❌ Ism juda qisqa. Iltimos, ism va familiyangizni toʻliq kiriting:")
        bot.register_next_step_handler(sent_msg, process_name)
        return

    cursor.execute("INSERT OR REPLACE INTO users (user_id, name) VALUES (?, ?)", (user_id, name))
    conn.commit()
    
    sent_msg = bot.send_message(
        user_id, 
        "Telefon raqamingizni kiriting (yoki pastdagi tugmani bosing):", 
        reply_markup=get_phone_keyboard()
    )
    bot.register_next_step_handler(sent_msg, process_phone)

def process_phone(message):
    user_id = message.chat.id
    phone = message.contact.phone_number if message.contact else message.text
    
    if not message.contact and not re.match(r"^\+?[0-9]{7,15}$", phone):
        sent_msg = bot.send_message(
            user_id, 
            "❌ Notoʻgʻri telefon raqami! Qaytadan kiriting yoki raqam yuborish tugmasini bosing:",
            reply_markup=get_phone_keyboard()
        )
        bot.register_next_step_handler(sent_msg, process_phone)
        return
        
    cursor.execute("UPDATE users SET phone = ? WHERE user_id = ?", (phone, user_id))
    conn.commit()
    
    sent_msg = bot.send_message(
        user_id, 
        "Gmail manzilingizni kiriting (Masalan: example@gmail.com):", 
        reply_markup=types.ReplyKeyboardRemove()
    )
    bot.register_next_step_handler(sent_msg, process_gmail)

def process_gmail(message):
    gmail = message.text.strip().lower()
    user_id = message.chat.id
    
    gmail_pattern = r"^[a-zA-Z0-9._%+-]+@gmail\.com$"
    if not re.match(gmail_pattern, gmail):
        sent_msg = bot.send_message(
            user_id, 
            "❌ Notoʻgʻri Gmail manzili! Oxiri '@gmail.com' boʻlishi shart.\n\nQaytadan kiriting:"
        )
        bot.register_next_step_handler(sent_msg, process_gmail)
        return
    
    cursor.execute("UPDATE users SET gmail = ? WHERE user_id = ?", (gmail, user_id))
    conn.commit()
    
    cursor.execute("SELECT name, phone, gmail FROM users WHERE user_id = ?", (user_id,))
    user = cursor.fetchone()
    
    bot.send_message(
        user_id,
        f"Roʻyxatdan oʻtish muvaffaqiyatli yakunlandi! 🎉\n\n"
        f"👤 Ism: {user[0]}\n"
        f"📱 Tel: {user[1]}\n"
        f"📧 Gmail: {user[2]}\n\n"
        f"Kerakli menyuni tanlang:",
        reply_markup=get_main_menu()
    )


# --- ASOSIY MENYU ---

@bot.message_handler(func=lambda message: message.text in ["💰 Balansni toʻldirish", "💸 Yechib olish", "📜 Oʻtkazmalar tarixi", "👨‍💻 Murojaat"])
def main_menu_buttons(message):
    if message.text == "💰 Balansni toʻldirish":
        bot.send_message(
            message.chat.id, 
            "Qaysi platforma balansini toʻldirmoqchisiz? Tanlang:", 
            reply_markup=get_casinos_keyboard()
        )
    elif message.text == "💸 Yechib olish":
        bot.send_message(message.chat.id, "💸 Yechib olish boʻlimi. Tez kunda ishga tushadi...")
    elif message.text == "📜 Oʻtkazmalar tarixi":
        bot.send_message(message.chat.id, "📜 Sizning oʻtkazmalaringiz tarixi hozircha boʻsh.")
    elif message.text == "👨‍💻 Murojaat":
        bot.send_message(message.chat.id, "👨‍💻 Adminga bogʻlanish uchun profil: @azizjonxalilov")


# --- KAZINO MANTIQI ---

@bot.callback_query_handler(func=lambda call: call.data.startswith("casino_"))
def process_casino_choice(call):
    casino_name = call.data.split("_")[1].upper()
    
    sent_msg = bot.edit_message_text(
        chat_id=call.message.chat.id,
        message_id=call.message.message_id,
        text=f"🎰 Siz {casino_name} platformasini tanladingiz.\n\n"
             f"Iltimos, ushbu platformadagi **ID raqamingizni** yozib yuboring:"
    )
    bot.register_next_step_handler(sent_msg, lambda msg: save_id_and_ask_photo(msg, casino_name))

def save_id_and_ask_photo(message, casino_name):
    user_id = message.chat.id
    casino_id = message.text
    
    if not casino_id.isdigit():
        sent_msg = bot.send_message(user_id, "❌ ID faqat raqamlardan iborat boʻlishi kerak. Qaytadan kiriting:")
        bot.register_next_step_handler(sent_msg, lambda msg: save_id_and_ask_photo(msg, casino_name))
        return

    sent_msg = bot.send_message(
        user_id, 
        f"✅ Raqam qabul qilindi: `{casino_id}`\n\n"
        f"💳 **Toʻlov maʼlumotlari:**\n"
        f"Plastic Karta: `9860600434410723`\n"
        f"Egasi: **Azizbek Xalilov**\n\n"
        f"Toʻlovni amalga oshiring va {casino_name} hisobiga toʻlov qilgan **chekingiz (skrinshot) rasmini** shu yerga yuboring:",
        parse_mode="Markdown"
    )
    bot.register_next_step_handler(sent_msg, lambda msg: handle_receipt_photo(msg, casino_name, casino_id))


# --- CHEK QABUL QILISH VA ADMINGA YUBORISH ---

def handle_receipt_photo(message, casino_name, casino_id):
    user_id = message.chat.id
    user_name = message.from_user.first_name
    username = message.from_user.username if message.from_user.username else "Mavjud emas"
    
    if not message.photo:
        sent_msg = bot.send_message(user_id, "❌ Iltimos, faqat toʻlov chekining rasmini yuboring:")
        bot.register_next_step_handler(sent_msg, lambda msg: handle_receipt_photo(msg, casino_name, casino_id))
        return

    bot.send_message(user_id, "✅ Chek qabul qilindi! Admin tekshirmoqda, balans tez orada toʻldiriladi.", reply_markup=get_main_menu())
    
    photo_id = message.photo[-1].file_id
    bot.send_photo(
        ADMIN_ID, 
        photo_id, 
        caption=f"🔔 **YANGI TOʻLOV CHЕKI KЕLDI!**\n\n"
                f"👤 Mijoz: {user_name} (@{username})\n"
                f"🆔 Platforma ID: `{casino_id}`\n"
                f"🎰 Kazino: {casino_name}\n\n"
                f"Kartangizni tekshiring va pastdagi tugmalardan birini bosing:",
        reply_markup=get_admin_buttons(user_id, casino_name, casino_id),
        parse_mode="Markdown"
    )


# --- ADMIN TUGMALARI ISHLOVCHISI (CALLBACK) ---

@bot.callback_query_handler(func=lambda call: call.data.startswith(("accept_", "reject_")))
def handle_admin_decision(call):
    data = call.data.split("_")
    action = data[0]
    client_id = data[1]
    
    if action == "accept":
        casino_name = data[2]
        casino_id = data[3]
        
        # Mijozga xabar berish
        try:
            bot.send_message(
                client_id, 
                f"✅ **Toʻlovingiz tasdiqlandi!**\n\n"
                f"🎰 {casino_name} oʻyin hisobingiz (ID: {casino_id}) muvaffaqiyatli toʻldirildi. Oʻyinni boshlashingiz mumkin! 🚀",
                parse_mode="Markdown"
            )
        except Exception:
            pass
            
        # Admin xabarini yangilash
        bot.edit_message_caption(
            chat_id=call.message.chat.id,
            message_id=call.message.message_id,
            caption=call.message.caption + "\n\n🟢 **[STATUS: TASDIQLANDI]**"
        )
        
    elif action == "reject":
        # Mijozga xabar berish
        try:
            bot.send_message(
                client_id, 
                "❌ **Toʻlovingiz rad etildi!**\n\n"
                "Yuborilgan chekda xatolik bor yoki pul hisobimizga kelib tushmadi. Muammo boʻlsa adminga murojaat qiling.",
                parse_mode="Markdown"
            )
        except Exception:
            pass
            
        # Admin xabarini yangilash
        bot.edit_message_caption(
            chat_id=call.message.chat.id,
            message_id=call.message.message_id,
            caption=call.message.caption + "\n\n🔴 **[STATUS: RAD ETILDI]**"
        )


if __name__ == '__main__':
    print("Bot muvaffaqiyatli ishga tushdi...")
    bot.infinity_polling()

