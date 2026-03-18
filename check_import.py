import sys
import os

# Mimic app.py path setup
current_dir = os.path.dirname(os.path.abspath(__file__))
# backend/app.py would comply this, but I'm placing this in root
sys.path.append(current_dir)

try:
    import src.tools
    print(f"src.tools is loaded from: {src.tools.__file__}")
except ImportError as e:
    print(f"ImportError: {e}")
except Exception as e:
    print(f"Error: {e}")
