
import torch

weights_path = r"C:\Users\forbh\Desktop\langchain_projects\langchain-rag\improved_chronos_model.pth.zip"

try:
    print(f"Loading weights from: {weights_path}")
    state_dict = torch.load(weights_path)
    print("\n--- Model Layers ---")
    for key, value in state_dict.items():
        print(f"{key}: {value.shape}")
        
except Exception as e:
    print(f"Error loading: {e}")
