from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv(override=True)

key = os.getenv("GROQ_API_KEY")
print(f"Testing key: {key[:10]}...")

try:
    client = Groq(api_key=key)
    chat_completion = client.chat.completions.create(
        messages=[{"role": "user", "content": "hi"}],
        model="llama3-8b-8192",
    )
    print("SUCCESS:", chat_completion.choices[0].message.content)
except Exception as e:
    print("FAILURE:", e)
