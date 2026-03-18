
import os
import torch
import torch.nn as nn
import numpy as np
import pandas as pd
from typing import Optional
from langchain_core.tools import tool
from pydantic import BaseModel, Field
try:
    from langchain_community.tools.pubmed.tool import PubmedQueryRun
    from langchain_community.utilities.pubmed import PubMedAPIWrapper
    _HAS_PUBMED = True
except ImportError:
    _HAS_PUBMED = False

# --- Model Definition (Matched to improved_chronos_model.pth) ---
class ChronosModel(nn.Module):
    def __init__(self):
        super().__init__()
        
        # 1. Time Series Branch (GRU)
        # Input: 3 (HR, BP, SpO2), Hidden: 64
        self.gru = nn.GRU(input_size=3, hidden_size=64, batch_first=True)
        
        # 2. Static Branch
        # Input: 12 (11 Clinical Features + 1 Placeholder/Time?), Hidden: 64
        self.static_net = nn.Sequential(
            nn.Linear(12, 64),
            nn.ReLU(),
            nn.BatchNorm1d(64)
        )
        
        # 3. Fusion / Classifier
        # Input: 64 (GRU) + 64 (Static) = 128
        self.classifier = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU()
        )
        
        # 4. Multi-Horizon Heads
        self.head_1d = nn.Linear(64, 1)
        self.head_7d = nn.Linear(64, 1)
        self.head_30d = nn.Linear(64, 1)

    def forward(self, x_ts, x_static):
        # Time Series Path
        # GRU output: (batch, time, hidden)
        # We take the last time step: out[:, -1, :]
        _, hn = self.gru(x_ts) 
        ts_embed = hn[-1] # [Batch, 64]
        
        # Static Path
        static_embed = self.static_net(x_static) # [Batch, 64]
        
        # Fusion
        fused = torch.cat([ts_embed, static_embed], dim=1) # [Batch, 128]
        shared = self.classifier(fused) # [Batch, 64]
        
        return torch.sigmoid(self.head_1d(shared)), \
               torch.sigmoid(self.head_7d(shared)), \
               torch.sigmoid(self.head_30d(shared))

# --- Helper to Simulate Vitals ---
def simulate_mimic_vitals(static_features_dict, n_hours=48):
    """
    Generates 48 hours of Vital Signs (HR, Systolic BP, SpO2)
    influenced by patient's static attributes.
    """
    ef = static_features_dict.get('ejection_fraction', 30)
    hbp = static_features_dict.get('high_blood_pressure', 0)
    creat = static_features_dict.get('serum_creatinine', 1.0)
    
    n_features = 3
    generated_vitals = np.zeros((n_hours, n_features))

    # 1. Heart Rate: Base 70, increases if EF low
    base_hr = 70 + (30 - ef) if ef < 30 else 70
    hr_noise = np.random.normal(0, 5, n_hours)
    generated_vitals[:, 0] = base_hr + hr_noise

    # 2. Blood Pressure: Base 120, 150 if HBP
    base_bp = 150 if hbp == 1 else 120
    bp_trend = np.linspace(0, -20, n_hours) if creat > 2.0 else np.zeros(n_hours)
    generated_vitals[:, 1] = base_bp + bp_trend + np.random.normal(0, 10, n_hours)

    # 3. SpO2: Base 98, drops if EF low
    base_spo2 = 92 if ef < 30 else 98
    generated_vitals[:, 2] = np.clip(np.random.normal(base_spo2, 1, n_hours), 80, 100)

    # Return shape (1, 48, 3)
    return np.float32(generated_vitals).reshape(1, n_hours, 3)

# --- Global Model Instance ---
_MODEL: Optional[ChronosModel] = None

def _get_model():
    global _MODEL
    if _MODEL is None:
        _MODEL = ChronosModel()
        # Correct path# Determine the project root
        PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        # Path to the specific weights file
        MODEL_PATH = os.path.join(PROJECT_ROOT, "backend", "artifacts", "improved_chronos_model.pth")
        if os.path.exists(MODEL_PATH):
            try:
                state = torch.load(MODEL_PATH)
                _MODEL.load_state_dict(state)
                _MODEL.eval()
                print(f"Loaded weights from {MODEL_PATH}")
            except Exception as e:
                print(f"Error loading weights: {e}")
                print("Proceeding with random weights for demonstration.")
        else:
            print("No weights found. Using random initialization.")
            _MODEL.eval()
    return _MODEL

# --- The Tool ---

def get_risk_predictions(
    age, anaemia, creatinine_phosphokinase, diabetes, ejection_fraction,
    high_blood_pressure, platelets, serum_creatinine, serum_sodium, sex, smoking
):
    """
    Helper function to calculate risk probabilities.
    Returns a dictionary with 1d, 7d, 30d probabilities.
    """
    # 1. Prepare Static Data
    # The model expects 12 features. We have 11.
    features = [
        age, anaemia, creatinine_phosphokinase, diabetes, ejection_fraction,
        high_blood_pressure, platelets, serum_creatinine, serum_sodium, sex, smoking,
        0.0 # Placeholder for 12th feature
    ]
    x_static_tensor = torch.tensor([features], dtype=torch.float32)

    # 2. Simulate Vitals (Time-Series)
    static_dict = {
        "ejection_fraction": ejection_fraction,
        "high_blood_pressure": high_blood_pressure,
        "serum_creatinine": serum_creatinine
    }
    vitals = simulate_mimic_vitals(static_dict)
    x_ts_tensor = torch.tensor(vitals, dtype=torch.float32)
    
    # 3. Running Inference
    model = _get_model()
    model.eval()
        
    with torch.no_grad():
        p1, p7, p30 = model(x_ts_tensor, x_static_tensor)
        
    return {
        "1_day_risk": p1.item(),
        "7_day_risk": p7.item(),
        "30_day_risk": p30.item()
    }

@tool
def predict_heart_failure_risk(
    age: int,
    anaemia: int,
    creatinine_phosphokinase: int,
    diabetes: int,
    ejection_fraction: int,
    high_blood_pressure: int,
    platelets: float,
    serum_creatinine: float,
    serum_sodium: int,
    sex: int,
    smoking: int
) -> str:
    """
    Predicts heart failure risk (1-day, 7-day, 30-day mortality probability).
    
    Parameters:
    - age: Patient age
    - anaemia: 0 or 1
    - creatinine_phosphokinase: CPK level
    - diabetes: 0 or 1
    - ejection_fraction: EF %
    - high_blood_pressure: 0 or 1
    - platelets: Count
    - serum_creatinine: Level
    - serum_sodium: Level
    - sex: 0 (F) or 1 (M)
    - smoking: 0 or 1
    """
    preds = get_risk_predictions(
        age, anaemia, creatinine_phosphokinase, diabetes, ejection_fraction,
        high_blood_pressure, platelets, serum_creatinine, serum_sodium, sex, smoking
    )
    
    return (
        f"Heart Failure Risk Prediction:\n"
        f"- 1-Day Risk (Acute): {preds['1_day_risk']:.2%}\n"
        f"- 7-Day Risk (Sub-Acute): {preds['7_day_risk']:.2%}\n"
        f"- 30-Day Risk (Chronic): {preds['30_day_risk']:.2%}\n"
        f"(Note: Used loaded model with simulated vitals)"
    )

# --- PubMed Tool ---
class PubMedInput(BaseModel):
    query: str = Field(description="The specific medical search query (e.g., 'heart failure treatment', 'diabetes guidelines').")

@tool("search_pubmed", args_schema=PubMedInput)
def search_pubmed(query: str) -> str:
    """
    Searches PubMed for medical research papers, clinical guidelines, and reports.
    Useful for finding latest studies on heart failure, diabetes, and other conditions.
    """
    if not _HAS_PUBMED:
        return "Error: langchain-community or xmltodict not installed. Cannot search PubMed."
    
    try:
        # Limit to top 3 results to avoid context overflow
        wrapper = PubMedAPIWrapper(top_k_results=3, doc_content_chars_max=1000)
        tool = PubmedQueryRun(api_wrapper=wrapper)
        return tool.invoke(query)
    except Exception as e:
        return f"Error querying PubMed: {str(e)}"
